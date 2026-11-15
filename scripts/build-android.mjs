import { spawnSync } from 'node:child_process';
import { mkdir, copyFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';
const env = { ...process.env };
async function findModernJdk() {
  const roots = [
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Eclipse Adoptium'),
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Java'),
  ];
  for (const rootDir of roots) {
    let entries = [];
    try { entries = await readdir(rootDir, { withFileTypes: true }); }
    catch { continue; }
    const candidate = entries
      .filter(entry => entry.isDirectory() && /(?:jdk|temurin)[-_]?((?:2[1-9]|[3-9]\d)(?:\.\d+)?)/i.test(entry.name))
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
      .find(() => true);
    if (candidate) return path.join(rootDir, candidate.name);
  }
  return null;
}

if (windows && env.JAVA_HOME && !/jdk-(?:1[0-9]|20)(?:\.|$)/i.test(env.JAVA_HOME)) {
  // Keep an explicitly configured modern JDK.
} else if (windows) {
  const modernJdk = await findModernJdk();
  if (modernJdk) env.JAVA_HOME = modernJdk;
}
if (env.JAVA_HOME) {
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = `${path.join(env.JAVA_HOME, 'bin')}${path.delimiter}${env[pathKey] || ''}`;
}
if (windows && !env.ANDROID_HOME && env.LOCALAPPDATA) {
  const conventionalSdk = path.join(env.LOCALAPPDATA, 'Android', 'Sdk');
  try {
    await access(conventionalSdk);
    env.ANDROID_HOME = conventionalSdk;
    env.ANDROID_SDK_ROOT ||= conventionalSdk;
  } catch { /* Gradle will report the missing SDK with its standard message. */ }
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: windows,
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run('npm', ['run', 'build']);
run('npx', ['cap', 'sync', 'android']);
const signingEnv = ['LBW_ANDROID_KEYSTORE', 'LBW_ANDROID_STORE_PASSWORD', 'LBW_ANDROID_KEY_ALIAS', 'LBW_ANDROID_KEY_PASSWORD'];
const releaseSigned = signingEnv.every(key => process.env[key]);
const variant = releaseSigned ? 'release' : 'debug';
run(windows ? 'gradlew.bat' : './gradlew', [`assemble${variant[0].toUpperCase()}${variant.slice(1)}`], path.join(root, 'android'));

const output = path.join(root, 'release');
await mkdir(output, { recursive: true });
await copyFile(
  path.join(root, 'android', 'app', 'build', 'outputs', 'apk', variant, `app-${variant}.apk`),
  path.join(output, 'Little-Batch-Works.apk'),
);
console.log(`${releaseSigned ? 'Signed release' : 'Debug-signed'} APK written to ${path.join(output, 'Little-Batch-Works.apk')}`);
