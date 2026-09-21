import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, rename } from 'node:fs/promises';

const poseFile = fileURLToPath(new URL('./public/eagle-poses.json', import.meta.url));
let saveQueue = Promise.resolve();
const poseEditor = {
  name: 'eagle-pose-editor',
  configureServer(server) {
    server.middlewares.use('/__eagle/save', async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST' || req.headers.origin !== `http://${req.headers.host}`) {
        res.statusCode = 403; res.end(JSON.stringify({ error: 'Local editor requests only.' })); return;
      }
      try {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 16000) throw new Error('Request too large.'); }
        const { section, reference } = JSON.parse(body);
        if (!['home','security','ai','how','buyers','supply','about','how-to-buy','faq','contact'].includes(section)) throw new Error('Invalid section.');
        const ranges = { width:[320,3840], height:[320,2160], time:[0,600], speed:[0.25,2], x:[-100,200], y:[-100,200], zoom:[5,400], yaw:[-180,180], pitch:[-180,180], roll:[-180,180] };
        const pose = {};
        for (const [key,[min,max]] of Object.entries(ranges)) {
          if (!Number.isFinite(reference?.[key]) || reference[key] < min || reference[key] > max) throw new Error('Invalid '+key);
          pose[key] = reference[key];
        }
        pose.clip = String(reference.clip).split('|').at(-1);
        if (!['idle_A0','fly_start_A','fly_A0','fly_A_to_gliding_A','gliding_A0'].includes(pose.clip)) throw new Error('Invalid clip.');
        const save = saveQueue.catch(() => {}).then(async () => {
          const data = JSON.parse(await readFile(poseFile, 'utf8'));
          const device = pose.width <= 600 ? 'mobile' : 'desktop';
          data[device][section] = pose;
          await writeFile(poseFile + '.tmp', JSON.stringify(data, null, 2) + '\n');
          await rename(poseFile + '.tmp', poseFile);
        });
        saveQueue = save; await save;
        res.end(JSON.stringify({ saved: true }));
        server.ws.send({ type: 'custom', event: 'eagle-poses-updated', data: {} });
      } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })); }
    });
  },
};

export default defineConfig({
  plugins: [poseEditor],
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        playground: fileURLToPath(new URL('./eagle-playground/index.html', import.meta.url)),
      },
    },
  },
});
