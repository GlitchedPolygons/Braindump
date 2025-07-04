import {fileURLToPath, URL} from 'node:url';

import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config

export default defineConfig(({command, mode, isSsrBuild, isPreview}) =>
{
    if (command === 'serve')
    {
        return {
            plugins: [
                vue(),
                vueDevTools(),
            ],
            resolve: {
                alias: {
                    '@': fileURLToPath(new URL('./src', import.meta.url))
                },
            },
            BackendBaseURL: "https://api-dev.glitchedpolygons.com/content-dump",
            FrontendBaseURL: "https://dev-braindump.glitchedpolygons.com",
            LoginLogoURL: "https://api-files.glitchedpolygons.com/api/v1/files/brain-256x256.png",
            ThemeSwitcherLogoURL: "https://api-files.glitchedpolygons.com/api/v1/files/brain-256x256.png"
        }
    }
    else
    {
        return {
            plugins: [
                vue(),
                vueDevTools(),
            ],
            resolve: {
                alias: {
                    '@': fileURLToPath(new URL('./src', import.meta.url))
                },
            },
            BackendBaseURL: "https://api.glitchedpolygons.com/content-dump",
            FrontendBaseURL: "https://braindump.glitchedpolygons.com",
            LoginLogoURL: "https://api-files.glitchedpolygons.com/api/v1/files/brain-256x256.png",
            ThemeSwitcherLogoURL: "https://api-files.glitchedpolygons.com/api/v1/files/brain-256x256.png"
        }
    }
});
