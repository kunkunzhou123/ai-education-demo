const path = require('node:path');
function integer(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer in ${min}..${max}`);
  return value;
}
function config() {
  const key = process.env.ASSESSMENT_API_KEY || process.env.DEEPSEEK_API_KEY;
  const endpoint = process.env.ASSESSMENT_BASE_URL || 'https://api.deepseek.com/chat/completions';
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Model endpoint requires HTTPS, except local development endpoints');
  if (url.username || url.password || url.search || url.hash) throw new Error('Model endpoint must not contain credentials, query or fragment');
  return {
    key, endpoint, provider: !key ? 'offline-rules' : url.hostname === 'api.deepseek.com' ? 'deepseek' : 'compatible-api',
    evaluatorModel: process.env.ASSESSMENT_MODEL || 'deepseek-chat',
    plannerModel: process.env.PLANNER_MODEL || process.env.ASSESSMENT_MODEL || 'deepseek-chat',
    dataDir: process.env.MASTERY_DATA_DIR || path.join(__dirname,'../../data/sessions'),
    maxSteps: integer('HARNESS_MAX_STEPS',8,3,20),
    maxModelCalls: integer('HARNESS_MAX_MODEL_CALLS',6,2,12),
    maxOutputTokens: integer('HARNESS_MAX_OUTPUT_TOKENS',1200,256,4096),
    maxSessionTokens: integer('HARNESS_MAX_SESSION_TOKENS',100000,8000,1000000),
    maxContextChars: integer('HARNESS_MAX_CONTEXT_CHARS',14000,4000,40000),
    modelTimeoutMs: integer('HARNESS_MODEL_TIMEOUT_MS',30000,100,60000),
    runTimeoutMs: integer('HARNESS_RUN_TIMEOUT_MS',90000,1000,180000),
    retentionHours: integer('RETENTION_HOURS',24,1,168),
    maxDiagnosticTurns:10
  };
}
module.exports={config};
