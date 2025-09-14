const origLog = console.log;
const origWarn = console.warn;

console.log = (...args: any[]) => {
  const msg = args.join(' ');
  if (msg.includes('[dotenv')) return; // silence dotenv banner
  origLog(...args);
};

console.warn = (...args: any[]) => {
  const msg = args.join(' ');
  if (msg.includes('[MONGOOSE] Warning: Duplicate schema index')) return;
  origWarn(...args);
};
