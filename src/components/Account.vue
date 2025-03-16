<script setup
        lang="ts">

import {ref} from "vue";

let confirmDeletion = ref(false);

function onClickDeleteAccount(): void
{
  // todo: impl
}

</script>

<template>

  <div class="page-title">

    <div class="row">

      <div class="col-lg-8 order-md-1 order-last">

        <h3>
          Account
        </h3>

        <p class="text-subtitle text-muted">
          Manage your Braindump account here and perform security improvements, such as
          changing your password or enabling 2FA (that's a great idea, seriously! Always use 2FA wherever
          possible!).
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

    <div class="row"
         style="justify-content: center;">

      <div class="col-lg-8">

        <div class="card">

          <div class="card-header">

            <h5 class="card-title">
              Change Password
            </h5>

          </div>

          <div class="card-body">

            <form action="#"
                  method="get">

              <div class="form-group my-2">

                <label for="current_password"
                       class="form-label">
                  Current password
                </label>

                <input type="password"
                       name="current_password"
                       id="current_password"
                       class="form-control"
                       placeholder="Enter your current password"
                       value="">
              </div>

              <div class="form-group my-2">

                <label for="password"
                       class="form-label">
                  New password
                </label>

                <input type="password"
                       name="password"
                       id="password"
                       class="form-control"
                       placeholder="Enter new password"
                       value="">
              </div>

              <div class="form-group my-2">

                <label for="confirm_password"
                       class="form-label">
                  Confirm new password
                </label>

                <input type="password"
                       name="confirm_password"
                       id="confirm_password"
                       class="form-control"
                       placeholder="Re-enter new password"
                       value="">
              </div>

              <div style="margin-top: 32px;"></div>

              <div class="form-group my-2 d-flex justify-content-end">

                <button type="submit"
                        class="btn btn-primary bdmp-button">
                  Save Changes
                </button>

              </div>

            </form>

          </div>

        </div>

      </div>

      <div class="col-lg-8">

        <div class="card">

          <div class="card-header">
            <h5 class="card-title">
              Two-Factor Authentication
            </h5>
          </div>

          <div class="card-body">

            <form action="#"
                  method="get">

              <div class="form-group my-2">

                <label for="email"
                       class="form-label">
                  Current Email
                </label>

                <input type="email"
                       name="email"
                       id="email"
                       class="form-control"
                       placeholder="Enter your current email"
                       value="john.doe@example.net">
              </div>

              <div style="margin-top: 32px;"></div>

              <div class="form-group my-2 d-flex justify-content-end">

                <button type="submit"
                        class="btn btn-primary bdmp-button">
                  Save Changes
                </button>

              </div>

            </form>

          </div>

        </div>

      </div>

      <div class="col-lg-8">

        <div class="card">

          <div class="card-header">

            <h5 class="card-title">
              Delete Account
            </h5>

          </div>

          <div class="card-body">

            <form action="#"
                  method="get">

              <p>
                Your account will be permanently deleted and cannot be restored. Tick the checkbox below to proceed...
              </p>

              <div class="form-check">

                <div class="checkbox">

                  <input type="checkbox"
                         id="checkbox-confirm-account-deletion"
                         v-model="confirmDeletion"
                         class="form-check-input">

                  <label for="checkbox-confirm-account-deletion"
                         unselectable="on"
                         class="unselectable">
                    Click here to confirm permanent deletion
                  </label>
                </div>
              </div>

              <div style="margin-top: 32px;"></div>

              <div class="form-group my-2 d-flex justify-content-end">

                <button type="submit"
                        class="btn btn-danger bdmp-button"
                        id="btn-delete-account"
                        @click="onClickDeleteAccount"
                        :disabled="!confirmDeletion">
                  Delete
                </button>

              </div>

            </form>
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

</style>