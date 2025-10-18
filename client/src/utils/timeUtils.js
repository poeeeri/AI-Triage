export function getWaitingTime(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60)); 
}

export function shouldHighlightCritical(createdAt, priority) {
  if (priority !== "критично срочно") return false;
  const waitingTime = getWaitingTime(createdAt);
  return waitingTime > 10; 
}

export function shouldHighlightUrgent(createdAt, priority) {
  if (priority !== "срочно") return false;
  const waitingTime = getWaitingTime(createdAt);
  return waitingTime > 30; 
}

export function getTimeToNextHighlight(createdAt, priority) {
  if (priority === "критично срочно") {
    const waitingTime = getWaitingTime(createdAt);
    return Math.max(0, (10 * 60 * 1000) - (waitingTime * 60 * 1000)); 
  }
  if (priority === "срочно") {
    const waitingTime = getWaitingTime(createdAt);
    return Math.max(0, (30 * 60 * 1000) - (waitingTime * 60 * 1000)); 
  }
  return null;
}