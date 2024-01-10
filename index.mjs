import * as qs from 'qs';
import * as crypto from 'crypto';
import { default as axios } from 'axios';

let token = '';

const config = {
  // Change the following URL according to your Tuya account region.
  host: 'https://openapi.tuyaus.com',
  // Your Access ID from Tuya project overview page.
  accessKey: '',
  // Your Access Secret from Tuya project overview page.
  secretKey: '',
  // Your Device ID from Tuya devices page.
  deviceId: '',
};

const httpClient = axios.create({
  baseURL: config.host,
  timeout: 5 * 1e3,
});

async function main() {
  await getToken();

  const data = await getDeviceInfo(config.deviceId);

  // If an error occurs, try changing the ch_rtd to another one until it works.
  let poolTemperature = parsePoolTemperature(data.result.status.find(x => x.code == 'ch_rtd1').value); ''
  // I don't know if every sensor uses this channel to send the ambient temperature, but it worked for me.
  let ambientTemperature = parseAmbientTemperature(data.result.status.find(x => x.code == 'ch_para').value); ''
  
  console.log("Pool Temperature: " + poolTemperature.sensor);
  console.log('Ambient Temperature: ' + ambientTemperature.sensor);
}

async function getToken() {
  const method = 'GET';
  const timestamp = Date.now().toString();
  const signUrl = '/v1.0/token?grant_type=1';
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  const stringToSign = [method, contentHash, '', signUrl].join('\n');
  const signStr = config.accessKey + timestamp + stringToSign;
  const headers = {
    t: timestamp,
    sign_method: 'HMAC-SHA256',
    client_id: config.accessKey,
    sign: await encryptStr(signStr, config.secretKey),
  };
  const { data: login } = await httpClient.get('/v1.0/token?grant_type=1', { headers });

  if (!login || !login.success) {
    throw Error(`Fetch Failed: ${login.msg}`);
  }

  token = login.result.access_token;
}

async function getDeviceInfo(deviceId) {
  const query = {};
  const method = 'GET';
  const url = `/v1.0/devices/${deviceId}`;
  const reqHeaders = await getRequestSign(url, method, {}, query);
  const { data } = await httpClient.request({
    method,
    data: {},
    params: {},
    headers: reqHeaders,
    url: reqHeaders.path,
  });

  if (!data || !data.success) {
    throw Error(`Request API Failed: ${data.msg}`);
  }

  return data;
}

async function encryptStr(str, secret) {
  return crypto.createHmac('sha256', secret).update(str, 'utf8').digest('hex').toUpperCase();
}

async function getRequestSign(
  path,
  method,
  query = {},
  body = {},
) {
  const t = Date.now().toString();
  const [uri, pathQuery] = path.split('?');
  const queryMerged = Object.assign(query, qs.parse(pathQuery));
  const sortedQuery = {};

  Object.keys(queryMerged)
    .sort()
    .forEach((i) => (sortedQuery[i] = query[i]));

  const querystring = decodeURIComponent(qs.stringify(sortedQuery));
  const url = querystring ? `${uri}?${querystring}` : uri;
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const stringToSign = [method, contentHash, '', url].join('\n');
  const signStr = config.accessKey + token + t + stringToSign;

  return {
    t,
    path: url,
    client_id: config.accessKey,
    sign: await encryptStr(signStr, config.secretKey),
    sign_method: 'HMAC-SHA256',
    access_token: token,
  };
}

// I don't know if this will work for your device, if won't, change the value until it matches.
function parsePoolTemperature(input) {
  let bytesSensor = Buffer.from(input, "base64");
  let temperature = { sensor: (bytesSensor[51] + bytesSensor[15]) / 10};
  return temperature;
}

// I don't know if this will work for your device, if won't, change the value until it matches.
function parseAmbientTemperature(input) {
  let bytesSensor = Buffer.from(input, "base64");
  let temperature = { sensor: (bytesSensor[17] + bytesSensor[18]) / 10};
  return temperature;
}

main().catch(err => {
  throw Error(`error: ${err}`);
});
