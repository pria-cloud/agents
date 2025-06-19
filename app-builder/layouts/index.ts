export const layouts = {
  sidebar: {
    name: 'Sidebar',
    structure: {
      header: true,
      sidebar: true,
      footer: true,
      main: true,
    },
    description: 'Sidebar menu with header and footer. Sidebar on the left, main content on the right.'
  },
  topbar: {
    name: 'Topbar',
    structure: {
      header: true,
      sidebar: false,
      footer: true,
      main: true,
    },
    description: 'Top navigation bar, main content below, footer at the bottom.'
  },
  dashboard: {
    name: 'Dashboard',
    structure: {
      header: true,
      sidebar: true,
      widgets: true,
      footer: true,
      main: true,
    },
    description: 'Dashboard with sidebar, header, widgets grid, and footer.'
  },
  minimal: {
    name: 'Minimal',
    structure: {
      header: false,
      sidebar: false,
      footer: false,
      main: true,
    },
    description: 'Minimal layout with only main content.'
  },
  splitPane: {
    name: 'Split Pane',
    structure: {
      header: true,
      leftPane: true,
      rightPane: true,
      footer: true,
    },
    description: 'Two main panes side by side, with header and footer.'
  },
  threeColumn: {
    name: 'Three Column',
    structure: {
      header: true,
      leftSidebar: true,
      center: true,
      rightSidebar: true,
      footer: true,
    },
    description: 'Three columns: left sidebar, center content, right sidebar, with header and footer.'
  },
  heroHeader: {
    name: 'Hero Header',
    structure: {
      hero: true,
      main: true,
      footer: true,
    },
    description: 'Large hero section at the top, main content below, footer at the bottom.'
  },
  custom: {
    name: 'Custom',
    structure: {},
    description: 'Describe your own layout structure in freeform. The agent will use your description to generate the layout.'
  }
}; 