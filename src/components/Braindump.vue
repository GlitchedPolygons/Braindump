<script setup
        lang="ts">

import ThemeSwitcher from "@/components/ThemeSwitcher.vue";

const year: number = new Date().getFullYear();

</script>

<template>

  <div id="sidebar">
    <div class="sidebar-wrapper active">
      <div class="sidebar-header position-relative">
        <div class="d-flex justify-content-between align-items-center">

          <ThemeSwitcher />

          <div class="sidebar-toggler x">
            <a href="javascript:void(0);"
               class="sidebar-hide d-xl-none d-block"><i class="bi bi-x bi-middle"></i></a>
          </div>
        </div>
      </div>

      <div class="sidebar-menu">
        <ul class="menu">
          <li class="sidebar-title">
            Menu
          </li>

          <li
              class="sidebar-item active ">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-grid-fill"></i>
              <span>Dashboard</span>
            </a>


          </li>

          <li
              class="sidebar-item  has-sub">
            <a href="javascript:void(0);"
               class='sidebar-link'>
              <i class="bi bi-stack"></i>
              <span>Components</span>
            </a>

            <ul class="submenu ">

              <li class="submenu-item  ">
                <a href="component-accordion.html"
                   class="submenu-link">Accordion</a>

              </li>

              <li class="submenu-item  ">
                <a href="component-alert.html"
                   class="submenu-link">Alert</a>

              </li>

            </ul>


          </li>


          <li class="sidebar-title">
            Pages
          </li>

          <li
              class="sidebar-item  ">
            <a href="application-email.html"
               class='sidebar-link'>
              <i class="bi bi-envelope-fill"></i>
              <span>Email Application</span>
            </a>


          </li>

          <li
              class="sidebar-item  ">
            <a href="application-chat.html"
               class='sidebar-link'>
              <i class="bi bi-chat-dots-fill"></i>
              <span>Chat Application</span>
            </a>


          </li>

        </ul>
      </div>
    </div>
  </div>

  <div id="main">

    <header class="mb-3">
      <a href="javascript:void(0);"
         class="burger-btn d-block d-xl-none">
        <i class="bi bi-justify fs-3"></i>
      </a>
    </header>

    <div class="page-heading">
      <h3>
        Braindump
      </h3>
    </div>

    <div class="page-content">

    </div>

    <footer>
      <div class="footer clearfix mb-0 text-muted">
        <div class="float-start">
          <p>
            Copyright &copy; 2024-{{ year }}
            <br />
            <a href="https://glitchedpolygons.com"
               target="_blank">
              Glitched Polygons GmbH
            </a>
          </p>
        </div>
        <div class="float-end">
          <p>
            Crafted with <span class="text-danger"><i class="bi bi-heart-fill icon-mid"></i></span>
            by
            Raphael Beck
            <br />
            Source code available on
            <a href="https://github.com/GlitchedPolygons/Braindump"
               target="_blank">
              GitHub <span><i class="bi bi-github"></i></span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  </div>

</template>

<style scoped>

</style>