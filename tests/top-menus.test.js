import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Barra de Menús Superior y Pestañas del Sidebar (index.html)', () => {
  it('Contiene la barra de menús superior con Archivo, Ver, Capas y Táctica', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    document.body.innerHTML = html;

    const topMenuBar = document.getElementById('top-menu-bar');
    expect(topMenuBar).toBeTruthy();

    const menuFile = document.getElementById('menu-popup-file');
    const menuView = document.getElementById('menu-popup-view');
    const menuLayers = document.getElementById('menu-popup-layers');
    const menuTools = document.getElementById('menu-popup-tools');

    expect(menuFile).toBeTruthy();
    expect(menuView).toBeTruthy();
    expect(menuLayers).toBeTruthy();
    expect(menuTools).toBeTruthy();
  });

  it('Contiene la barra de pestañas compacta en el sidebar', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    document.body.innerHTML = html;

    const sidebarTabs = document.getElementById('sidebar-tabs');
    expect(sidebarTabs).toBeTruthy();

    const tabButtons = sidebarTabs.querySelectorAll('.sidebar-tab-btn');
    expect(tabButtons.length).toBeGreaterThanOrEqual(5);

    const tabsList = Array.from(tabButtons).map(b => b.dataset.tab);
    expect(tabsList).toContain('all');
    expect(tabsList).toContain('routes');
    expect(tabsList).toContain('photos');
    expect(tabsList).toContain('layers');
    expect(tabsList).toContain('load');
  });
});
