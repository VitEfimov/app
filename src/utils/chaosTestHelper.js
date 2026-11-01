import dayjs from 'dayjs';

/**
 * Chaos & Stress Testing Harness for Mobile SRE & Fault Injection
 * 
 * Used in DevLogs to simulate:
 * 1. High-volume task injection (memory & FlashList GC benchmark)
 * 2. Storage tampering and corrupted payload recovery (OWASP MASVS resilience)
 * 3. Fast automated cleanup of chaos artifacts
 */

export const CHAOS_PREFIX = 'CHAOS_STRESS_';

export const ChaosTestHelper = {
  /**
   * Generates high-volume realistic tasks to benchmark memory and rendering.
   * @param {number} [count=200]
   * @param {string} [boardId='main']
   */
  generateStressTasks: (count = 200, boardId = 'main') => {
    const tasks = [];
    const priorities = ['none', 'low', 'medium', 'high', 'urgent'];
    const now = dayjs();

    for (let i = 1; i <= count; i++) {
      const dayOffset = (i % 30) - 5; // spans past, today, and future
      const dueDate = now.add(dayOffset, 'day').format('YYYY-MM-DD');
      const priority = priorities[i % priorities.length];
      const isRecurring = i % 4 === 0;

      tasks.push({
        id: `${CHAOS_PREFIX}${Date.now()}_${i}`,
        taskname: `Stress Task #${i} [Performance Benchmark]`,
        completed: i % 3 === 0,
        priority,
        dueDate,
        completionDate: dueDate,
        time: `${String(8 + (i % 12)).padStart(2, '0')}:00`,
        boardId,
        reminder: i % 2 === 0 ? '15 min before' : 'None',
        isAlarm: i % 5 === 0,
        isRecurring,
        repeatConfig: isRecurring ? { preset: 'Weekly', interval: 1 } : null,
        notes: `Synthetic task payload generated for high-density stress testing. Index ${i} / ${count}.`,
        subtasks: [
          { id: `sub_${i}_1`, title: 'Verify render performance', completed: true },
          { id: `sub_${i}_2`, title: 'Check memory footprint', completed: false }
        ]
      });
    }

    return tasks;
  },

  /**
   * Identifies whether a task is a synthetic chaos test task.
   * @param {object} task
   * @returns {boolean}
   */
  isChaosTask: (task) => {
    if (!task) return false;
    const id = String(task.id || '');
    const name = String(task.taskname || '');
    return id.startsWith(CHAOS_PREFIX) || name.includes('[Performance Benchmark]');
  },

  /**
   * Calculate memory payload metrics for state diagnostic reporting.
   * @param {Array} tasks
   * @returns {{ count: number, sizeBytes: number, sizeKb: number, formattedSize: string }}
   */
  getPayloadMetrics: (tasks = []) => {
    const json = JSON.stringify(tasks);
    const sizeBytes = typeof Buffer !== 'undefined' 
      ? Buffer.byteLength(json, 'utf8') 
      : json.length;
    const sizeKb = Math.round(sizeBytes / 1024);
    return {
      count: tasks.length,
      sizeBytes,
      sizeKb,
      formattedSize: `~${sizeKb} KB (${tasks.length} items)`
    };
  },

  /**
   * Simulates corrupted or tampered storage envelope to verify cryptographic auto-repair.
   * @param {object} cryptoStorageInstance
   * @param {object} rawStorage
   */
  testStorageCorruptionResilience: async (cryptoStorageInstance, rawStorage) => {
    const testKey = '@chaos_tamper_canary';
    try {
      // 1. Write an intentionally tampered envelope with invalid HMAC signature
      const corruptedEnvelope = JSON.stringify({
        __enc__: true,
        v: 1,
        alg: 'AES-256-CTR',
        iv: '0102030405060708090a0b0c0d0e0f10',
        ct: 'deadbeefcafebabe0102030405060708',
        mac: 'badc0ffeed000000000000000000000000000000000000000000000000000000',
        tag: 'badc0ffeed000000000000000000000000000000000000000000000000000000'
      });

      if (rawStorage && typeof rawStorage.setItem === 'function') {
        await rawStorage.setItem(testKey, corruptedEnvelope);
      }

      // 2. Read through CryptoStorage - must detect tamper and return null safely
      const readResult = await cryptoStorageInstance.getItem(testKey);
      const isTamperCaught = readResult === null;

      // 3. Clean up canary
      if (rawStorage && typeof rawStorage.removeItem === 'function') {
        await rawStorage.removeItem(testKey);
      }

      return {
        success: true,
        isTamperCaught,
        message: isTamperCaught 
          ? 'Integrity Verified: Tampered ciphertext was detected by HMAC verification and rejected without crashing.'
          : 'Warning: Tampered ciphertext was not rejected.'
      };
    } catch (e) {
      return {
        success: false,
        isTamperCaught: false,
        error: e.message
      };
    }
  }
};
