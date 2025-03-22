<script setup
        lang="ts">

import 'md-editor-v3/lib/style.css';
import {onMounted, reactive, ref} from "vue";
import {braindumpStore} from "@/braindump.ts";
import {MdEditor, MdPreview, config} from 'md-editor-v3';
import {LocalStorageKeys} from "@/constants.ts";

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

function onClickCancel(): void
{
  // todo
}

async function onClickSaveBraindump(): Promise<void>
{
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

              <div class="form-group my-2">

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
                        :maxLength="1048576"
                        noUploadImg
                        @onChange="onChangedMarkdown"
                        language="en-US"
                        :toolbars="toolbar"
                        :theme="state.theme" />

              <div style="margin-top: 32px;"></div>

              <div class="form-group my-2 d-flex justify-content-end"
                   style="gap: 16px;">

                <button type="button"
                        :disabled="busy"
                        @click="onClickCancel"
                        class="btn btn-secondary bdmp-button">
                  Cancel
                </button>

                <button type="button"
                        :disabled="busy"
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

</style>