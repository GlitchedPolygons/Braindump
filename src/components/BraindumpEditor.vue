<script setup
        lang="ts">

import {onMounted, reactive, ref} from "vue";
import {braindumpStore} from "@/braindump.ts";
import {MdEditor} from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
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

let md = ref('# Heading 1\n\n## Heading 2');

const state = reactive({
  text: '',
  theme: 'dark',
});

let busy = ref(false);

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
                        :theme="state.theme" />

              <div style="margin-top: 32px;"></div>

              <div class="form-group my-2 d-flex justify-content-end">

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