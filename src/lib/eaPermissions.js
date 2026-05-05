/**
 * EA Permission Helper
 * 
 * Determines what actions an EA can take on a DirectorTask.
 * 
 * Rules:
 * 1. EA sees ALL tasks where director_email is one of their supported directors.
 * 2. EA CAN take management actions (verify, cancel, approve/reject date change)
 *    on tasks assigned to OTHER people — because EA manages on behalf of director.
 * 3. EA CANNOT take management actions on tasks assigned TO THE EA themselves —
 *    only the Director (or admin) can verify/cancel those.
 * 4. EA CAN still "Mark Done" and "Request Date Change" on tasks assigned to them
 *    (these are assignee-level actions, not management actions).
 */

/**
 * Check if the current user (EA) can perform management actions on this task.
 * Management actions: Verify, Cancel, Approve/Reject Date Change.
 *
 * @param {object} task - The DirectorTask record
 * @param {object} currentUser - The logged-in user { email, role }
 * @param {string[]} supportedDirectorEmails - Director emails this EA supports
 * @returns {boolean}
 */
export function canEAManageTask(task, currentUser, supportedDirectorEmails) {
  if (!task || !currentUser) return false;

  // Admins can always manage
  if (currentUser.role === 'admin') return true;

  // If the task's director is one the EA supports
  const isRelevantDirector = supportedDirectorEmails.includes(task.director_email);
  if (!isRelevantDirector) return false;

  // EA cannot manage tasks assigned directly to themselves — Director must handle those
  if (task.assigned_to_email === currentUser.email) return false;

  return true;
}