import packageJSON from './package.json';
import post from '../../discord-bitbeat/publishHook';

(async () => {
  try {
    await post(
      {
        content: `Version '${packageJSON.version}' was released.`,
        username: '@bitbeat/core',
      }
    );
  } catch (e) {
    console.error(e.toString());
    throw e;
  }
})();