export const BOARD_COLORS = [
  '#4CAF50', // Green (Main)
  '#2196F3', // Blue
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#FF5722', // Deep Orange
  '#3F51B5', // Indigo
  '#8BC34A', // Light Green
  '#FFC107', // Amber
];

export const getBoardColor = (boardOrId, boardsArray = []) => {
  if (typeof boardOrId === 'object' && boardOrId?.color) {
    return boardOrId.color;
  }
  const boardId = typeof boardOrId === 'object' ? boardOrId?.id : boardOrId;
  const foundBoard = boardsArray.find(b => b && (b.id === boardId || b._id === boardId));
  if (foundBoard && foundBoard.color) {
    return foundBoard.color;
  }
  const index = boardsArray.findIndex(b => b && (b.id === boardId || b._id === boardId));
  const safeIndex = index >= 0 ? index : (boardId === 'main' ? 0 : 1);
  return BOARD_COLORS[safeIndex % BOARD_COLORS.length];
};
