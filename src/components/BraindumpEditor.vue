<script setup
        lang="ts">

import 'md-editor-v3/lib/style.css';
import {onMounted, reactive, ref} from "vue";
import {braindumpStore} from "@/braindump.ts";
import {MdEditor, MdPreview, config} from 'md-editor-v3';
import {EndpointURLs, LocalStorageKeys, TypeNamesDTO} from "@/constants.ts";
import {arrayBufferToHexEncodedString, getUnixTimestamp, logout} from "@/util.ts";
import bdConfig from "@/assets/config.json";

type ImgUploadCallback = (url: string) => void;

let editing = ref(true);

let edited = ref({
  Guid: '',
  CreationTimestampUTC: 0,
  LastModificationTimestampUTC: 0,
  Notes: '',
  Name: '',
  Data: '',
  Private: true,
});

let md = ref('');

let busy = ref(false);

const state = reactive({
  text: '',
  theme: 'dark',
});

const toolbar = [
  'revoke',
  'next',

  '-',

  'task',
  'unorderedList',
  'orderedList',

  '-',

  'bold',
  'italic',
  'strikeThrough',

  '-',

  'title',
  'sub',
  'sup',

  '-',

  'quote',
  'codeRow',
  'code',

  '-',

  'link',
  'image',
  'table',
  'mermaid',
  'katex',

  '=',

  'pageFullscreen',
  'preview',
  'previewOnly',
];

config({
  editorConfig: {
    renderDelay: 64
  },
  markdownItPlugins(plugins, {editorId})
  {
    return plugins.map((item) =>
    {
      if (item.type === 'taskList')
      {
        return {
          ...item,
          options: {
            ...item.options,
            enabled: true,
          },
        };
      }
      return item;
    });
  },
});

onMounted(() =>
{
  if (braindumpStore.editedBraindump)
  {
    editing.value = false;

    edited.value = braindumpStore.editedBraindump;
  }

  window.onChangedTheme = (theme: string) =>
  {
    state.theme = theme;
  };

  window.onChangedTheme(localStorage.getItem(LocalStorageKeys.THEME));
});

function onChangedMarkdown(markdown: string): void
{
  // todo
}

async function onUploadImg(files: File[], callback: ImgUploadCallback): Promise<void>
{
  const r = await Promise.all
  (
      files.map((file) =>
      {
        return new Promise(async (rev, rej) =>
        {
          const form = new FormData();

          const sha256 = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer())

          form.append('sha256', arrayBufferToHexEncodedString(sha256));
          form.append('filename', `${getUnixTimestamp()}-${file.name}`);
          form.append('filesizebytes', file.size.toString());
          form.append('notes', edited.value.Notes);
          form.append('private', 'false');
          form.append('file', file);

          const requestContext = {
            method: 'POST',
            body: form,
            headers: {
              'Authorization': `Bearer ${localStorage.getItem(LocalStorageKeys.AUTH_TOKEN)}`,
            },
          };

          try
          {
            const response = await fetch
            (
                `${bdConfig.BackendBaseURL}${EndpointURLs.FILE_ENTRIES}`,
                requestContext
            );

            if (!response.ok)
            {
              switch (response.status)
              {
                case 400:
                {
                  const errorMsg: string = `Upload failed!\n\nErrors:\n${JSON.stringify((await response.json()).errors, null, 2)}`;
                  alert(errorMsg);
                  rej(errorMsg);
                  return;
                }
                case 401:
                case 403:
                {
                  logout();
                  return;
                }
                case 413:
                {
                  const errorMsg: string = 'Insufficient user quota! Please upload a smaller file or free some space on the remote file storage.';
                  alert(errorMsg);
                  rej(errorMsg);
                  return;
                }
                default:
                {
                  const errorMsg: string = 'Upload failed! Please upload the file on a different remote file storage and use a link instead. If this error persists, please inform the domain owner about this.';
                  alert(errorMsg);
                  rej(errorMsg);
                  return;
                }
              }
            }

            const responseBodyEnvelope = await response.json();

            if (responseBodyEnvelope.Type !== TypeNamesDTO.USER_FILE_UPLOAD_RESPONSE_DTO || !responseBodyEnvelope.Items || responseBodyEnvelope.Items.length !== 1)
            {
              rej(response);
            }

            rev(responseBodyEnvelope.Items[0]);
          }
          catch (e)
          {
            rej(e);
          }
        });
      })
  );

  callback(r.map((item) => `${bdConfig.BackendBaseURL}${EndpointURLs.FILE_ENTRIES}/${item?.Guid}`));
}

function onClickCancel(): void
{
  // todo
}

async function onClickSaveBraindump(): Promise<void>
{
  if (!edited.value.Name)
  {
    alert('Please enter a name for your braindump.');
  }

  if (edited.value.Notes === null)
  {
    edited.value.Notes = '';
  }

  // todo
}

</script>

<template>

  <div v-if="editing">

    <div class="page-title">

      <div class="row">

        <div class="col-12 order-md-1 order-last">

          <h3>
            Editor
          </h3>

          <p class="text-subtitle text-muted">
            Create or modify a braindump using the great <a href="https://www.markdownguide.org/getting-started/"
                                                            target="_blank">Markdown</a> syntax with this editor.
          </p>

        </div>

      </div>

    </div>

    <section class="section">

      <div class="row"
           style="justify-content: center;">

        <div class="col-12">

          <div class="card">

            <div class="card-header">

              <h5 class="card-title">
                Edit Braindump
              </h5>

            </div>

            <div class="card-body">

              <div class="form-group my-2">

                <label for="name"
                       class="form-label">
                  Name
                </label>

                <input type="text"
                       id="name"
                       name="name"
                       class="form-control"
                       v-model="edited.Name"
                       v-on:keyup.enter="onClickSaveBraindump();"
                       placeholder="Give your braindump a descriptive title">
              </div>

              <div class="form-group my-2"
                   style="margin-bottom: 0.85rem !important;">

                <label for="password"
                       class="form-label">
                  Notes
                </label>

                <textarea type="text"
                          name="notes"
                          id="notes"
                          rows="5"
                          maxlength="1000"
                          class="form-control"
                          v-model="edited.Notes"
                          placeholder="Enter an optional description of what this braindump is about."></textarea>

                <small class="unselectable"
                       :style="`margin-left: 2px; ${edited.Notes.length < 900 ? '' : edited.Notes.length < 980 ? 'color: orange' : 'color: red'}`">
                  {{ edited.Notes.length }} / 1000
                </small>

              </div>

              <MdEditor v-model="md"
                        :preview="false"
                        :maxLength="1048576"
                        :language="'en-US'"
                        :toolbars="toolbar"
                        :theme="state.theme"
                        :noUploadImg="braindumpStore.workingOffline"
                        @onUploadImg="onUploadImg"
                        @onChange="onChangedMarkdown" />

              <div style="margin-top: 32px;"></div>

              <div class="form-group my-2 d-flex justify-content-end"
                   style="gap: 24px;">

                <button type="button"
                        :disabled="busy"
                        @click="onClickCancel"
                        style="min-width: 96px;"
                        class="btn btn-secondary bdmp-button">
                  Cancel
                </button>

                <button type="button"
                        :disabled="busy"
                        style="min-width: 96px;"
                        @click="onClickSaveBraindump"
                        class="btn btn-primary bdmp-button">
                  Save
                </button>

              </div>


            </div>

          </div>

        </div>

      </div>

    </section>

  </div>

  <div v-else>

    <MdPreview :model-value="edited?.Data" />

  </div>


</template>

<style scoped>

.row {
  justify-content: center;
}

@media (max-width: 420px) {
  input, textarea, label {
    font-size: 0.89rem !important;
  }
}

#notes {
  min-height: 61px;
  max-height: 420px;
}

</style>