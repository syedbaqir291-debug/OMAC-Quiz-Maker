/**************************************************************
 * OMAC QUIZ LAUNCHER — Backend (Google Apps Script)
 * OMAC Developers · S M Baqir
 *
 * SETUP:
 * 1. Create a Google Sheet. Note its ID (from the URL).
 * 2. Extensions > Apps Script. Paste this whole file in as Code.gs.
 * 3. Set SHEET_ID below to your Sheet's ID.
 * 4. Run `setupSheet` once from the Apps Script editor (select it in
 *    the function dropdown, click Run). This creates all tabs and an
 *    admin account: admin@omac.dev / Admin@123 (CHANGE THIS PASSWORD
 *    immediately after first login from the Admin Dashboard).
 * 5. Deploy > New deployment > Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Copy the deployment URL (ends in /exec) into CONFIG.SCRIPT_URL
 *    in index.html.
 **************************************************************/

const SHEET_ID = '1Q-MJQAQ30NKueD3dCP9ycqYSTbqsriUb2k-_DQkVzeU';

const TABS = {
  USERS: 'Users',
  QUIZZES: 'Quizzes',
  ATTEMPTS: 'Attempts'
};

const USERS_HEADERS    = ['Email','FirstName','LastName','DOB','PasswordHash','QuizLimit','QuestionLimit','IsAdmin','CreatedAt'];
const QUIZZES_HEADERS  = ['QuizID','OwnerEmail','Title','CreatedAt','QuestionCount','DataJSON'];
const ATTEMPTS_HEADERS = ['AttemptID','QuizID','TakerName','Score','Total','SubmittedAt'];

/* ---------------- Setup ---------------- */

function setupSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ensureTab_(ss, TABS.USERS, USERS_HEADERS);
  ensureTab_(ss, TABS.QUIZZES, QUIZZES_HEADERS);
  ensureTab_(ss, TABS.ATTEMPTS, ATTEMPTS_HEADERS);

  const users = ss.getSheetByName(TABS.USERS);
  if (users.getLastRow() < 2) {
    users.appendRow([
      'admin@omac.dev', 'OMAC', 'Admin', '2000-01-01',
      sha256_('Admin@123'), 50, 60, true, new Date().toISOString()
    ]);
  }
}

function ensureTab_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
}

/* ---------------- Entry points ---------------- */

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getQuizForTaking') return json_(getQuizForTaking_(e.parameter.quizId));
    if (action === 'ping') return json_({ ok: true, message: 'OMAC Quiz Launcher backend is live.' });
    return json_({ ok: false, error: 'Unknown GET action.' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const handlers = {
      register: register_,
      login: login_,
      resetPassword: resetPassword_,
      createQuiz: createQuiz_,
      listQuizzes: listQuizzes_,
      deleteQuiz: deleteQuiz_,
      submitAttempt: submitAttempt_,
      adminListUsers: adminListUsers_,
      adminUpdateLimits: adminUpdateLimits_,
      adminResetPassword: adminResetPassword_,
      adminStats: adminStats_
    };
    if (!handlers[action]) return json_({ ok: false, error: 'Unknown action: ' + action });
    return json_(handlers[action](body));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Helpers ---------------- */

function sha256_(str) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return raw.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function usersSheet_() { return SpreadsheetApp.openById(SHEET_ID).getSheetByName(TABS.USERS); }
function quizzesSheet_() { return SpreadsheetApp.openById(SHEET_ID).getSheetByName(TABS.QUIZZES); }
function attemptsSheet_() { return SpreadsheetApp.openById(SHEET_ID).getSheetByName(TABS.ATTEMPTS); }

function findUserRow_(email) {
  const sheet = usersSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(email).toLowerCase()) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

function userObj_(row) {
  return {
    email: row[0], firstName: row[1], lastName: row[2], dob: row[3],
    quizLimit: row[5], questionLimit: row[6], isAdmin: row[7] === true || row[7] === 'TRUE',
    createdAt: row[8]
  };
}

function verifyUser_(email, passwordHash) {
  const found = findUserRow_(email);
  if (!found) return { ok: false, error: 'No account found for that email.' };
  if (String(found.row[4]) !== String(passwordHash)) return { ok: false, error: 'Incorrect password.' };
  return { ok: true, found };
}

function verifyAdmin_(email, passwordHash) {
  const v = verifyUser_(email, passwordHash);
  if (!v.ok) return v;
  if (!(v.found.row[7] === true || v.found.row[7] === 'TRUE')) return { ok: false, error: 'Not an admin account.' };
  return v;
}

function newId_(prefix) {
  return prefix + '_' + Utilities.getUuid().split('-')[0] + Date.now().toString(36);
}

/* ---------------- Auth ---------------- */

function register_(b) {
  const email = String(b.email || '').trim().toLowerCase();
  if (!email || !b.firstName || !b.lastName || !b.dob || !b.passwordHash) {
    return { ok: false, error: 'All fields are required.' };
  }
  if (findUserRow_(email)) return { ok: false, error: 'An account with this email already exists.' };
  usersSheet_().appendRow([
    email, b.firstName, b.lastName, b.dob, b.passwordHash, 5, 60, false, new Date().toISOString()
  ]);
  return { ok: true, user: userObj_([email, b.firstName, b.lastName, b.dob, '', 5, 60, false, new Date().toISOString()]) };
}

function login_(b) {
  const v = verifyUser_(b.email, b.passwordHash);
  if (!v.ok) return v;
  return { ok: true, user: userObj_(v.found.row) };
}

function resetPassword_(b) {
  const found = findUserRow_(b.email);
  if (!found) return { ok: false, error: 'No account found for that email.' };
  if (String(found.row[3]) !== String(b.dob)) {
    return { ok: false, error: 'Date of birth does not match our records.' };
  }
  usersSheet_().getRange(found.rowIndex, 5).setValue(b.newPasswordHash);
  return { ok: true };
}

/* ---------------- Quizzes ---------------- */

function createQuiz_(b) {
  const v = verifyUser_(b.email, b.passwordHash);
  if (!v.ok) return v;
  const user = v.found.row;
  const quizLimit = Number(user[5]);
  const questionLimit = Number(user[6]);

  if (!b.title || !Array.isArray(b.questions) || b.questions.length === 0) {
    return { ok: false, error: 'Quiz title and at least one question are required.' };
  }
  if (b.questions.length > questionLimit) {
    return { ok: false, error: 'This quiz has ' + b.questions.length + ' questions, which exceeds your limit of ' + questionLimit + '.' };
  }
  const existing = quizzesSheet_().getDataRange().getValues().slice(1)
    .filter(r => String(r[1]).toLowerCase() === String(b.email).toLowerCase());
  if (existing.length >= quizLimit) {
    return { ok: false, error: 'You have reached your limit of ' + quizLimit + ' quizzes. Contact the OMAC admin to request more.' };
  }

  const quizId = newId_('QZ');
  quizzesSheet_().appendRow([
    quizId, b.email, b.title, new Date().toISOString(), b.questions.length, JSON.stringify(b.questions)
  ]);
  return { ok: true, quizId };
}

function listQuizzes_(b) {
  const v = verifyUser_(b.email, b.passwordHash);
  if (!v.ok) return v;
  const data = quizzesSheet_().getDataRange().getValues();
  const rows = data.slice(1).filter(r => String(r[1]).toLowerCase() === String(b.email).toLowerCase());
  const attemptsData = attemptsSheet_().getDataRange().getValues().slice(1);
  const quizzes = rows.map(r => {
    const attemptCount = attemptsData.filter(a => a[1] === r[0]).length;
    return { quizId: r[0], title: r[2], createdAt: r[3], questionCount: r[4], attemptCount };
  });
  return { ok: true, quizzes, quizLimit: Number(v.found.row[5]), questionLimit: Number(v.found.row[6]) };
}

function deleteQuiz_(b) {
  const v = verifyUser_(b.email, b.passwordHash);
  if (!v.ok) return v;
  const sheet = quizzesSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === b.quizId && String(data[i][1]).toLowerCase() === String(b.email).toLowerCase()) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Quiz not found.' };
}

function getQuizForTaking_(quizId) {
  const data = quizzesSheet_().getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === quizId) {
      const questions = JSON.parse(data[i][5]).map(q => ({ q: q.q, options: q.options || null }));
      return { ok: true, title: data[i][2], questionCount: data[i][4], questions };
    }
  }
  return { ok: false, error: 'Quiz not found. The link may be incorrect or the quiz was removed.' };
}

function submitAttempt_(b) {
  const data = quizzesSheet_().getDataRange().getValues();
  let quizRow = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === b.quizId) { quizRow = data[i]; break; }
  }
  if (!quizRow) return { ok: false, error: 'Quiz not found.' };
  const questions = JSON.parse(quizRow[5]);
  let score = 0;
  questions.forEach((q, idx) => {
    const given = String((b.answers && b.answers[idx]) || '').trim().toLowerCase();
    const correct = String(q.answer || '').trim().toLowerCase();
    if (given && given === correct) score++;
  });
  attemptsSheet_().appendRow([
    newId_('AT'), b.quizId, b.takerName || 'Anonymous', score, questions.length, new Date().toISOString()
  ]);
  return { ok: true, score, total: questions.length };
}

/* ---------------- Admin ---------------- */

function adminListUsers_(b) {
  const v = verifyAdmin_(b.adminEmail, b.passwordHash);
  if (!v.ok) return v;
  const data = usersSheet_().getDataRange().getValues().slice(1);
  const users = data.map(r => ({
    email: r[0], firstName: r[1], lastName: r[2], quizLimit: r[5],
    questionLimit: r[6], isAdmin: r[7] === true || r[7] === 'TRUE', createdAt: r[8]
  }));
  return { ok: true, users };
}

function adminUpdateLimits_(b) {
  const v = verifyAdmin_(b.adminEmail, b.passwordHash);
  if (!v.ok) return v;
  const found = findUserRow_(b.targetEmail);
  if (!found) return { ok: false, error: 'Target user not found.' };
  const sheet = usersSheet_();
  if (b.quizLimit !== undefined) sheet.getRange(found.rowIndex, 6).setValue(Number(b.quizLimit));
  if (b.questionLimit !== undefined) sheet.getRange(found.rowIndex, 7).setValue(Number(b.questionLimit));
  return { ok: true };
}

function adminResetPassword_(b) {
  const v = verifyAdmin_(b.adminEmail, b.passwordHash);
  if (!v.ok) return v;
  const found = findUserRow_(b.targetEmail);
  if (!found) return { ok: false, error: 'Target user not found.' };
  usersSheet_().getRange(found.rowIndex, 5).setValue(b.newPasswordHash);
  return { ok: true };
}

function adminStats_(b) {
  const v = verifyAdmin_(b.adminEmail, b.passwordHash);
  if (!v.ok) return v;
  const users = usersSheet_().getDataRange().getValues().slice(1);
  const quizzes = quizzesSheet_().getDataRange().getValues().slice(1);
  const attempts = attemptsSheet_().getDataRange().getValues().slice(1);
  return {
    ok: true,
    totalUsers: users.length,
    totalQuizzes: quizzes.length,
    totalAttempts: attempts.length,
    totalQuestions: quizzes.reduce((s, r) => s + Number(r[4] || 0), 0)
  };
}
