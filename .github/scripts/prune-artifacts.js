/**
 * Prunes older GitHub Actions artifacts in the repository prior to uploading a new
 * artifact so total Actions storage stays well below GitHub's 500 MB free quota.
 */
async function pruneArtifacts({
  github,
  context,
  targetArtifactName,
  maxRepoBytes = 200 * 1024 * 1024,
}) {
  const { owner, repo } = context.repo;
  const allArtifacts = [];

  for (let page = 1; page <= 10; page++) {
    const res = await github.rest.actions.listArtifactsForRepo({
      owner,
      repo,
      per_page: 100,
      page,
    });
    const batch = res?.data?.artifacts || [];
    allArtifacts.push(...batch);
    if (batch.length < 100) break;
  }

  const activeArtifacts = allArtifacts.filter((a) => a && !a.expired);
  const deletedIds = new Set();

  const tryDelete = async (artifact) => {
    try {
      await github.rest.actions.deleteArtifact({
        owner,
        repo,
        artifact_id: artifact.id,
      });
      deletedIds.add(artifact.id);
      return true;
    } catch (err) {
      console.warn(
        `[pruneArtifacts] Failed to delete artifact ${artifact.name} (${artifact.id}):`,
        err?.message || err
      );
      return false;
    }
  };

  // 1. Replace previous uploads of the same artifact name so stale builds don't accumulate
  for (const artifact of activeArtifacts) {
    if (targetArtifactName && artifact.name === targetArtifactName) {
      await tryDelete(artifact);
    }
  }

  // 2. Enforce repo-wide byte ceiling by deleting oldest remaining artifacts first
  const remaining = activeArtifacts
    .filter((a) => !deletedIds.has(a.id))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let totalBytes = remaining.reduce((sum, a) => sum + (Number(a.size_in_bytes) || 0), 0);

  for (const artifact of remaining) {
    if (totalBytes <= maxRepoBytes) break;
    const removed = await tryDelete(artifact);
    if (removed) {
      totalBytes -= Number(artifact.size_in_bytes) || 0;
    }
  }

  return {
    deletedCount: deletedIds.size,
    remainingBytes: totalBytes,
  };
}

module.exports = pruneArtifacts;

