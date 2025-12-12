// Minimal Node/Express server for Kaizen Automation
// Provides:
// - Serves static files from ./public
// - GET /api/state (requires x-api-key)
// - POST /api/state (save state to data/state.json)
// - POST /webhook/* stubs that log payloads to data/webhooks.log
// - Uses API_SECRET env variable

const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const DATA_DIR = path.join(__dirname, 'data');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const STATE_FILE = path.join(DATA_DIR, 'state.json');
const WEBHOOK_LOG = path.join(DATA_DIR, 'webhooks.log');

const API_SECRET = process.env.API_SECRET || 'change_me';
const PORT = process.env.PORT || 3000;

const app = express();

// parse json and urlencoded (for Twilio form-encoded)
app.use(bodyParser.json({limit:'5mb'}));
app.use(bodyParser.urlencoded({extended:true}));

// serve static
app.use(express.static(path.join(__dirname, 'public')));

// simple middleware to check api key for protected POST endpoints
function requireApiKey(req, res, next){
  const key = req.headers['x-api-key'] || '';
  if(key && key === API_SECRET) return next();
  return res.status(401).json({ error: 'Unauthorized: missing or invalid x-api-key' });
}

// GET /api/state -> return saved state if exists
app.get('/api/state', requireApiKey, (req, res) => {
  if(!fs.existsSync(STATE_FILE)) return res.json({}); // empty
  try{
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    res.type('application/json').send(raw);
  }catch(err){
    res.status(500).json({error:'Read error', message: err.message});
  }
});

// POST /api/state -> save JSON to state file
app.post('/api/state', requireApiKey, (req, res) => {
  const state = req.body;
  if(!state) return res.status(400).json({error:'Missing JSON body'});
  try{
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    res.json({ ok: true, savedAt: new Date().toISOString() });
  }catch(err){
    res.status(500).json({error:'Write error', message:err.message});
  }
});

// Generic webhook stubs
function logWebhook(name, headers, body){
  const entry = { at: new Date().toISOString(), name, headers, body };
  try{
    fs.appendFileSync(WEBHOOK_LOG, JSON.stringify(entry) + '\n');
  }catch(e){
    console.error('Failed to write webhook log', e);
  }
}

app.post('/webhook/whatsapp', requireApiKey, (req, res) => {
  logWebhook('whatsapp', req.headers, req.body);
  res.json({received:true});
});
app.post('/webhook/twilio-sms', requireApiKey, (req, res) => {
  logWebhook('twilio-sms', req.headers, req.body);
  res.json({received:true});
});
app.post('/webhook/vapi', requireApiKey, (req, res) => {
  logWebhook('vapi', req.headers, req.body);
  res.json({received:true});
});
app.post('/webhook/sample', requireApiKey, (req, res) => {
  logWebhook('sample', req.headers, req.body);
  res.json({received:true});
});
app.post('/webhook/ghl', requireApiKey, (req, res) => {
  logWebhook('ghl', req.headers, req.body);
  res.json({received:true});
});

// fallback
app.use((req,res,next) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Kaizen Automation server listening on port ${PORT}`);
  console.log(`API_SECRET is ${API_SECRET ? 'SET' : 'NOT SET'}`);
});
