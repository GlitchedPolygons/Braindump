<script setup
        lang="ts">

import {selectOnFocus} from "@/util.ts";
import {ref} from "vue";
import {AES, aesKeyStore} from "@/aes.ts";

const aes: AES = new AES();

const maxTextFieldLength: number = 1024 * 64;

let copyAnim: number;
let copied = ref(false);
let toolsAesKey = ref('');
let toolsAesInput = ref('');
let toolsAesOutput = ref('');
let encryptionTask: Promise<string>;
let decryptionTask: Promise<string>;

async function onClickGenerateKey()
{
  if (toolsAesKey.value)
  {
    if (!confirm('Are you sure you want to generate a new key?\nConfirming this will overwrite the current one.'))
    {
      return;
    }
  }

  toolsAesKey.value = await aes.generateKey();
}

function onClickCopy(value: string): void
{
  if (!value)
  {
    return;
  }

  navigator.clipboard.writeText(value);

  copied.value = true;

  if (copyAnim)
  {
    window.clearTimeout(copyAnim);
  }

  copyAnim = window.setInterval(() =>
  {
    copied.value = false;
  }, 2048);
}

async function onClickEncrypt()
{
  if (!aesFieldCheck())
  {
    return;
  }

  try
  {
    toolsAesOutput.value = await encryptionTask;
    onChangeInputAES();
  }
  catch (e)
  {
    toolsAesOutput.value = 'Encryption failed.';
  }
}

async function onClickDecrypt()
{
  if (!aesFieldCheck())
  {
    return;
  }

  toolsAesOutput.value = await decryptionTask;

  if (!toolsAesOutput.value)
  {
    toolsAesOutput.value = 'Decryption failed.';
  }

  onChangeInputAES();
}

function onChangeInputAES(): void
{
  if (!aesFieldCheck())
  {
    return;
  }

  encryptionTask = aes.encryptString(toolsAesInput.value, toolsAesKey.value);
  decryptionTask = aes.decryptString(toolsAesInput.value, toolsAesKey.value);
}

function aesFieldCheck(): boolean
{
  if (!toolsAesKey.value)
  {
    toolsAesOutput.value = 'No key specified.';
    return false;
  }

  if (!toolsAesInput.value)
  {
    toolsAesOutput.value = 'Input field empty.';
    return false;
  }

  return true;
}

</script>

<template>

  <div class="page-title">

    <div class="row">

      <div class="col-lg-8 order-md-1 order-last">

        <h3>
          Tools
        </h3>

        <p class="text-subtitle text-muted">
          Here's a few useful tools for your convenience. Encrypt and decrypt strings on the fly, a few nifty little
          converters and some other utilities.
        </p>

      </div>

      <!--
      <div class="col-12 col-md-6 order-md-2 order-first">
        <nav aria-label="breadcrumb"
             class="breadcrumb-header float-start float-lg-end">
          <ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="index.html">Dashboard</a></li>
            <li class="breadcrumb-item active"
                aria-current="page">Security
            </li>
          </ol>
        </nav>
      </div>
      -->

    </div>

  </div>

  <section class="section">

    <div class="row">

      <div class="col-lg-8">

        <div class="card">

          <div class="accordion"
               id="accordionAES">

            <div class="accordion-item">

              <h2 class="accordion-header"
                  id="headingAccordionAES">

                <button class="accordion-button"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseAccordionAES"
                        aria-expanded="true"
                        aria-controls="collapseAccordionAES">

                  <strong>
                    AES-256 GCM - Encrypt / Decrypt
                  </strong>

                </button>

              </h2>

              <div id="collapseAccordionAES"
                   class="accordion-collapse collapse show"
                   aria-labelledby="headingAccordionAES"
                   data-bs-parent="#accordionAES">

                <div class="accordion-body">

                  <br />

                  <div class="form-group position-relative mb-3"
                       style="margin-right: 24px; margin-left: 24px;">

                    <div class="input-group mb-3">

                      <button class="btn btn-primary"
                              type="button"
                              title="Copy to clipboard"
                              :disabled="!toolsAesKey"
                              @click="onClickCopy(toolsAesKey)"
                              id="tools-aes-keygen">

                        <i class="bi bi-copy"
                           v-if="!copied"></i>

                        <i class="bi bi-check-circle"
                           v-if="copied"></i>

                      </button>

                      <input type="password"
                             id="tools-aes-key"
                             class="form-control"
                             v-model="toolsAesKey"
                             @focus="selectOnFocus"
                             placeholder="Encryption key">

                      <button class="btn btn-primary"
                              type="button"
                              @click="onClickGenerateKey"
                              id="tools-aes-keygen">
                        Generate key
                      </button>

                    </div>

                  </div>

                  <div class="card-body">

                    <div class="form-group with-title">

                    <textarea class="form-control"
                              id="tools-aes-input"
                              :maxlength="maxTextFieldLength"
                              v-model="toolsAesInput"
                              @input="onChangeInputAES"
                              rows="8"></textarea>

                      <label class="tools-aes-input-label unselectable">
                        Input &nbsp;

                        <a href="javascript:void(0);"
                           title="Copy to clipboard"
                           @click="onClickCopy(toolsAesInput)">
                          <i class="bi bi-copy"
                             v-if="!copied"></i>

                          <i class="bi bi-check-circle"
                             v-if="copied"></i>
                        </a>

                      </label>

                    </div>

                  </div>

                  <div id="tools-aes-buttons">

                    <button class="btn btn-primary bdmp-button"
                            type="button"
                            :disabled="!toolsAesKey || !toolsAesInput"
                            @click="onClickEncrypt">
                      Encrypt
                    </button>

                    <button class="btn btn-primary bdmp-button"
                            type="button"
                            :disabled="!toolsAesKey || !toolsAesInput"
                            @click="onClickDecrypt">
                      Decrypt
                    </button>

                  </div>

                  <div class="card-body">

                    <div class="form-group with-title mb-3">

                    <textarea class="form-control"
                              id="tools-aes-output"
                              v-model="toolsAesOutput"
                              rows="8"></textarea>

                      <label class="tools-aes-input-label unselectable">
                        Output &nbsp;

                        <a href="javascript:void(0);"
                           title="Copy to clipboard"
                           @click="onClickCopy(toolsAesOutput)">
                          <i class="bi bi-copy"
                             v-if="!copied"></i>

                          <i class="bi bi-check-circle"
                             v-if="copied"></i>
                        </a>
                      </label>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>

  </section>

</template>

<style scoped>

.row {
  justify-content: center;
}

#tools-aes-input,
#tools-aes-output {
  padding-top: 2.75rem;
}

#tools-aes-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: -16px;
  margin-bottom: -8px;
}

.card-body {
  margin-bottom: -12px;
}

@media (max-width: 512px) {
  .accordion-body {
    padding: 0 !important;
  }

  input, .btn {
    font-size: 0.89rem !important;
  }
}

</style>