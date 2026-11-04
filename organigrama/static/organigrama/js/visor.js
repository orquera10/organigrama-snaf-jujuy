/**
 * SNAF - Organigrama Interactivo · Vista Pública de Consulta (Solo Lectura)
 * Permite explorar la estructura completa, sectores y nómina sin opciones de modificación.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'SNAF_ORGANIGRAMA_STATE_V19';

  // State
  let state = {
    sectores: [],
    personal: []
  };

  // Canvas / Organigram interaction state
  let orgScale = 1;
  let orgTranslateX = 0;
  let orgTranslateY = 0;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let collapsedNodes = new Set();
  let highlightMultiSector = false;
  let orgSearchQuery = '';
  let orgFilterRep = 'all';

  // Drawer & Modal state
  let activeDrawerSectorId = null;
  let activeViewingPersonId = null;

  // ========================================================================
  // INITIALIZATION
  // ========================================================================
  function init() {
    loadState();
    initCollapsedState();
    setupEventListeners();
    updateHeaderKPIs();
    renderOrganigram(true);
  }

  function loadState() {
    try {
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V16');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V17');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V18');

      // En el visor público siempre priorizar los datos oficiales más recientes provistos por el servidor
      if (window.SERVER_ORGANIGRAMA_DATA && window.SERVER_ORGANIGRAMA_DATA.sectores) {
        state = JSON.parse(JSON.stringify(window.SERVER_ORGANIGRAMA_DATA));
      } else if (window.INITIAL_ORGANIGRAMA_DATA) {
        state = JSON.parse(JSON.stringify(window.INITIAL_ORGANIGRAMA_DATA));
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) state = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading saved state, using fallback initialData:', e);
      if (window.INITIAL_ORGANIGRAMA_DATA) {
        state = JSON.parse(JSON.stringify(window.INITIAL_ORGANIGRAMA_DATA));
      }
    }

    // Clean out any remnants of Juventud
    if (state.sectores) {
      state.sectores = state.sectores.filter(s => s.id !== 'dir-juventud' && !s.nombre.toLowerCase().includes('juventud'));

      // Reorder sectors under sec-snaf so dir-ninez family is anteúltima and dir-dispositivos is última
      function getAllDescendantIds(rootId, secList) {
        const result = [rootId];
        const queue = [rootId];
        while (queue.length > 0) {
          const curr = queue.shift();
          const subChildren = secList.filter(s => s.parent_id === curr);
          for (const ch of subChildren) {
            result.push(ch.id);
            queue.push(ch.id);
          }
        }
        return result;
      }
      const ninezIds = new Set(getAllDescendantIds('dir-ninez', state.sectores));
      const withoutNinez = state.sectores.filter(s => !ninezIds.has(s.id));
      const ninezSectors = state.sectores.filter(s => ninezIds.has(s.id));
      const dispIdx = withoutNinez.findIndex(s => s.id === 'dir-dispositivos');
      if (dispIdx !== -1 && ninezSectors.length > 0) {
        state.sectores = [
          ...withoutNinez.slice(0, dispIdx),
          ...ninezSectors,
          ...withoutNinez.slice(dispIdx)
        ];
      }

      // Update Coordinación de Promoción de Derechos authority
      const secProm = state.sectores.find(s => s.id === 'coord-promocion');
      if (secProm) {
        secProm.responsable = 'Nora Roxana Guerrero';
        secProm.cargo_responsable = 'Responsable a cargo';
      }

      // Ensure informatica appears before rrhh
      const idxR = state.sectores.findIndex(s => s.id === 'rrhh');
      const idxI = state.sectores.findIndex(s => s.id === 'informatica');
      if (idxR !== -1 && idxI !== -1 && idxR < idxI) {
        const itemR = state.sectores[idxR];
        state.sectores[idxR] = state.sectores[idxI];
        state.sectores[idxI] = itemR;
      }
    }
    if (state.personal) {
      state.personal = state.personal.map(p => {
        p.sectores = (p.sectores || []).filter(s => s.sector_id !== 'dir-juventud' && !s.sector_nombre.toLowerCase().includes('juventud') && !s.reparticion.toLowerCase().includes('juventud')).map(s => {
          if (s.sector_id === 'sec-snaf') {
            const snom = s.sector_nombre || '';
            if (snom.includes('Guillermo Snopek')) s.sector_id = 'cdi-guillermo-snopek';
            else if (snom.includes('Santa Cecilia')) s.sector_id = 'cdi-santa-cecilia';
            else if (snom.includes('Eva Peron') || snom.includes('Eva Perón')) s.sector_id = 'cdi-eva-peron';
            else if (snom.includes('Sistema de Cuidados')) s.sector_id = 'sede-dpdc';
          }
          return s;
        });
        p.is_multi_sector = p.sectores.length > 1;
        return p;
      }).filter(p => p.sectores.length > 0);

      // Ensure Informática personnel are both designated as Personal Técnico
      const dario = state.personal.find(p => p.id === 'CUIL_20334827322' || (p.apellidos && p.apellidos.includes('ORQUERA')));
      if (dario) {
        dario.profesion = 'Personal Técnico (Informática / Sistemas)';
        if (dario.sectores) {
          dario.sectores.forEach(s => {
            if (s.sector_id === 'informatica') {
              s.funcion = 'Personal Técnico';
              s.condicion = 'Personal Técnico';
            }
          });
        }
      }

      const magana = state.personal.find(p => p.id === 'CUIL_23942486979' || (p.apellidos && (p.apellidos.includes('MAGAÑA') || p.apellidos.includes('MAGANA'))));
      if (magana) {
        magana.profesion = 'Personal Técnico (Informática / Sistemas)';
        if (magana.sectores) {
          magana.sectores.forEach(s => {
            if (s.sector_id === 'informatica') {
              s.funcion = 'Personal Técnico';
              s.condicion = 'Personal Técnico';
              s.observaciones = 'Personal Técnico - Referente Informático GDE / ALS (SNAF)';
            }
          });
        }
      }

      // Ensure Nora Roxana Guerrero is marked as Responsable a cargo in Promoción de Derechos
      const nora = state.personal.find(p => p.id === 'CUIL_27239460130' || (p.apellidos && p.apellidos.includes('GUERRERO') && p.nombres && p.nombres.includes('NORA')));
      if (nora) {
        nora.profesion = 'Responsable de Área';
        nora.observaciones_generales = 'Responsable a cargo hasta designación de nuevo coordinador';
        if (nora.sectores) {
          nora.sectores.forEach(s => {
            if (s.sector_id === 'coord-promocion') {
              s.funcion = 'Responsable a cargo';
              s.condicion = 'Responsable / Jerárquico';
              s.observaciones = 'Responsable a cargo hasta designación de nuevo coordinador';
            }
          });
        }
      }
    }
  }

  function initCollapsedState() {
    collapsedNodes.clear();
    if (state.sectores) {
      state.sectores.forEach(s => {
        const hasChildren = state.sectores.some(c => c.parent_id === s.id);
        if (hasChildren && s.id !== 'sec-snaf') {
          collapsedNodes.add(s.id);
        }
      });
    }
  }

  function updateHeaderKPIs() {
    const totalPersonal = state.personal.length;
    const totalSectores = state.sectores.length;
    const totalMulti = state.personal.filter(p => p.is_multi_sector || (p.sectores && p.sectores.length > 1)).length;
    const gdeCapCount = state.personal.filter(p => (p.capacitacion_gde || '').toUpperCase() === 'SI').length;
    const gdePercent = totalPersonal > 0 ? Math.round((gdeCapCount / totalPersonal) * 100) : 0;

    const elPersonal = document.getElementById('kpi-total-personal');
    const elSectores = document.getElementById('kpi-total-sectores');
    const elMulti = document.getElementById('kpi-multi-sector');
    const elGde = document.getElementById('kpi-gde-cap');

    if (elPersonal) elPersonal.textContent = totalPersonal;
    if (elSectores) elSectores.textContent = totalSectores;
    if (elMulti) elMulti.textContent = totalMulti;
    if (elGde) elGde.textContent = `${gdePercent}%`;
  }

  // ========================================================================
  // CONTROLS & EVENT LISTENERS
  // ========================================================================
  function setupEventListeners() {
    const viewport = document.getElementById('org-viewport');
    const searchInput = document.getElementById('org-search-input');
    const filterRep = document.getElementById('org-filter-reparticion');
    const btnMultiHigh = document.getElementById('btn-toggle-multi-highlight');
    const btnExpandAll = document.getElementById('btn-expand-all');
    const btnCollapseAll = document.getElementById('btn-collapse-all');
    const btnFitScreen = document.getElementById('btn-fit-screen');
    const btnPrint = document.getElementById('btn-print-org');

    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    const btnFitFloating = document.getElementById('btn-fit-floating');

    // Pan & Zoom on Viewport
    if (viewport) {
      viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.sector-card') || e.target.closest('.card-collapse-toggle') || e.target.closest('.control-btn') || e.target.closest('.canvas-floating-controls')) {
          return;
        }
        isPanning = true;
        panStartX = e.clientX - orgTranslateX;
        panStartY = e.clientY - orgTranslateY;
        viewport.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        orgTranslateX = e.clientX - panStartX;
        orgTranslateY = e.clientY - panStartY;
        applyCanvasTransform();
      });

      window.addEventListener('mouseup', () => {
        if (isPanning) {
          isPanning = false;
          if (viewport) viewport.style.cursor = 'grab';
        }
      });

      // Wheel Zoom
      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        zoomOrganigram(delta, e.clientX, e.clientY);
      }, { passive: false });

      // Touch Pan
      let touchStartX = 0, touchStartY = 0;
      viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX - orgTranslateX;
          touchStartY = e.touches[0].clientY - orgTranslateY;
        }
      }, { passive: true });

      viewport.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          orgTranslateX = e.touches[0].clientX - touchStartX;
          orgTranslateY = e.touches[0].clientY - touchStartY;
          applyCanvasTransform();
        }
      }, { passive: true });
    }

    // Zoom Buttons
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => zoomOrganigram(0.15));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => zoomOrganigram(-0.15));
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => {
        orgScale = 1;
        fitOrganigramToScreen();
      });
    }
    if (btnFitScreen) btnFitScreen.addEventListener('click', () => fitOrganigramToScreen());
    if (btnFitFloating) btnFitFloating.addEventListener('click', () => fitOrganigramToScreen());

    // Search in Organigram
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        orgSearchQuery = e.target.value.trim().toLowerCase();
        if (orgSearchQuery.length > 0) {
          // Auto-expand all when searching so matches are visible
          collapsedNodes.clear();
        }
        renderOrganigram(false);
      });
    }

    // Filter by branch / direction
    if (filterRep) {
      filterRep.addEventListener('change', (e) => {
        orgFilterRep = e.target.value;
        initCollapsedState();
        renderOrganigram(true);
      });
    }

    // Multi-sector highlight toggle
    if (btnMultiHigh) {
      btnMultiHigh.addEventListener('click', () => {
        highlightMultiSector = !highlightMultiSector;
        btnMultiHigh.classList.toggle('active', highlightMultiSector);
        renderOrganigram(false);
      });
    }

    // Expand all branches
    if (btnExpandAll) {
      btnExpandAll.addEventListener('click', () => {
        collapsedNodes.clear();
        renderOrganigram(false);
      });
    }

    // Collapse to main areas
    if (btnCollapseAll) {
      btnCollapseAll.addEventListener('click', () => {
        initCollapsedState();
        renderOrganigram(true);
      });
    }

    // Print
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }

    // Window resize
    window.addEventListener('resize', () => {
      fitOrganigramToScreen();
    });

    // Drawer & Modal Backdrop and Close Buttons
    const drawer = document.getElementById('drawer-sector');
    const btnCloseDrawer = document.getElementById('btn-close-drawer-sector');
    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeSectorDrawer);
    if (drawer) {
      drawer.addEventListener('click', (e) => {
        if (e.target === drawer) closeSectorDrawer();
      });
    }

    const modalViewPerson = document.getElementById('modal-view-person');
    const btnCloseView = document.getElementById('btn-close-modal-view-person');
    const btnCloseViewFooter = document.getElementById('btn-close-modal-view-person-footer');
    if (btnCloseView) btnCloseView.addEventListener('click', closeViewPersonModal);
    if (btnCloseViewFooter) btnCloseViewFooter.addEventListener('click', closeViewPersonModal);
    if (modalViewPerson) {
      modalViewPerson.addEventListener('click', (e) => {
        if (e.target === modalViewPerson) closeViewPersonModal();
      });
    }

    // Escape Key Listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const viewM = document.getElementById('modal-view-person');
        const drw = document.getElementById('drawer-sector');
        if (viewM && viewM.classList.contains('active')) {
          closeViewPersonModal();
        } else if (drw && drw.classList.contains('active')) {
          closeSectorDrawer();
        }
      }
    });
  }

  // ========================================================================
  // ZOOM & PAN LOGIC
  // ========================================================================
  function zoomOrganigram(delta, clientX = null, clientY = null) {
    const prevScale = orgScale;
    orgScale = Math.min(Math.max(orgScale + delta, 0.25), 1.6);

    const viewport = document.getElementById('org-viewport');
    if (clientX !== null && clientY !== null && viewport) {
      const rect = viewport.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      orgTranslateX = mouseX - (mouseX - orgTranslateX) * (orgScale / prevScale);
      orgTranslateY = mouseY - (mouseY - orgTranslateY) * (orgScale / prevScale);
    }

    applyCanvasTransform();
  }

  function applyCanvasTransform() {
    const canvas = document.getElementById('org-canvas');
    if (canvas) {
      canvas.style.transform = `translate(${orgTranslateX}px, ${orgTranslateY}px) scale(${orgScale})`;
    }
  }

  function fitOrganigramToScreen() {
    const viewport = document.getElementById('org-viewport');
    const tree = document.querySelector('.org-tree');
    if (!viewport || !tree) return;

    const vpWidth = viewport.clientWidth;
    const vpHeight = viewport.clientHeight;
    const treeWidth = tree.offsetWidth;
    const treeHeight = tree.offsetHeight;

    if (treeWidth <= 0 || treeHeight <= 0) return;

    const targetWidth = vpWidth - 60;
    const targetHeight = vpHeight - 60;

    const scaleX = targetWidth / treeWidth;
    const scaleY = targetHeight / treeHeight;
    let idealScale = Math.min(scaleX, 1.0);
    idealScale = Math.max(0.35, Math.min(idealScale, 0.95));

    orgScale = Math.round(idealScale * 100) / 100;

    const effectiveWidth = treeWidth * orgScale;
    if (effectiveWidth < vpWidth) {
      orgTranslateX = Math.round((vpWidth - effectiveWidth) / 2);
    } else {
      orgTranslateX = 30;
    }
    orgTranslateY = 30;

    applyCanvasTransform();
  }

  // ========================================================================
  // ORGANIGRAM TREE RENDERER
  // ========================================================================
  function renderOrganigram(autoFit = true) {
    const canvas = document.getElementById('org-canvas');
    if (!canvas) return;

    let rootId = 'sec-snaf';
    if (orgFilterRep !== 'all') {
      rootId = orgFilterRep;
    }

    const rootSector = state.sectores.find(s => s.id === rootId);
    if (!rootSector) {
      canvas.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">No se encontró el sector raíz del organigrama.</div>';
      return;
    }

    canvas.innerHTML = '';
    const treeContainer = document.createElement('div');
    treeContainer.className = 'org-tree';

    const rootNodeEl = buildTreeNode(rootSector);
    treeContainer.appendChild(rootNodeEl);
    canvas.appendChild(treeContainer);

    if (orgSearchQuery) {
      const firstHigh = canvas.querySelector('.sector-card.highlighted');
      if (firstHigh) {
        firstHigh.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    } else if (autoFit) {
      requestAnimationFrame(() => {
        fitOrganigramToScreen();
      });
    }
  }

  function buildTreeNode(sector) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node-wrapper';

    // Staff in this sector
    const staff = getPersonnelInSector(sector.id);

    // Guarantee Dario Orquera listed first in Informática
    if (sector.id === 'informatica') {
      staff.sort((a, b) => {
        if (a.apellidos.includes('ORQUERA')) return -1;
        if (b.apellidos.includes('ORQUERA')) return 1;
        return 0;
      });
    }

    const multiSectorStaff = staff.filter(p => p.is_multi_sector);
    const isCollapsed = collapsedNodes.has(sector.id);

    // Search match
    let isMatched = false;
    if (orgSearchQuery) {
      const nameMatch = (sector.nombre || '').toLowerCase().includes(orgSearchQuery);
      const respMatch = (sector.responsable || '').toLowerCase().includes(orgSearchQuery);
      const staffMatch = staff.some(p => 
        (p.apellidos + ' ' + p.nombres).toLowerCase().includes(orgSearchQuery) ||
        (p.cuil || '').includes(orgSearchQuery)
      );
      if (nameMatch || respMatch || staffMatch) {
        isMatched = true;
      }
    }

    // Determine primary authority / person name (leave empty if no responsable or placeholder 'A designar')
    let primaryPersonName = '';
    const rawResp = (sector.responsable || '').trim();
    if (sector.id === 'sec-snaf') {
      primaryPersonName = 'Dra. Marta Iriarte';
    } else if (rawResp && normText(rawResp) !== 'a designar') {
      primaryPersonName = formatPersonName(rawResp);
    }

    const hasSubordinates = staff.length >= 1;
    const staffCountLabel = staff.length === 1 ? '1 persona' : `${staff.length} personas`;

    // Determine card level dynamically from actual parent chain: Level 0 (root), Level 1 (yellow), Level 2 (green), Level 3+ (silver)
    const realLevel = getDynamicSectorLevel(sector);
    sector.nivel = realLevel;
    const cardLevel = (realLevel >= 3) ? 3 : realLevel;

    // Card element
    const card = document.createElement('div');
    card.className = `sector-card level-${cardLevel}`;
    if (isMatched) card.classList.add('highlighted');
    if (highlightMultiSector && multiSectorStaff.length > 0) {
      card.style.outline = '2px solid #f59e0b';
    }

    card.innerHTML = `
      <div class="card-content-inner">
        <div class="sector-title">${escapeHtml(sector.nombre)}</div>
        
        ${primaryPersonName ? `
        <div class="sector-person-compact">
          <div class="sector-person-name">${escapeHtml(primaryPersonName)}</div>
        </div>
        ` : ''}

        ${hasSubordinates ? `
          <div class="card-staff-expanded">
            <div class="staff-expanded-list">
              ${staff.map(p => `
                <div class="staff-expanded-item">
                  <div class="staff-expanded-name">${escapeHtml(formatPersonName(p))}</div>
                  ${p.cargo_funcion && p.cargo_funcion !== 'Agente' && p.cargo_funcion !== 'PERSONAL' ? `<div class="staff-expanded-role">${escapeHtml(p.cargo_funcion)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card-staff-toggle-wrapper">
            <button type="button" class="btn-toggle-staff" title="Ampliar cuadro y ver usuarios dependientes">
              <span class="btn-toggle-text"><i class="fi fi-rr-users-alt"></i> ${staffCountLabel} <i class="fi fi-rr-angle-small-down"></i></span>
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // Toggle button to expand/collapse full staff inside the card
    if (hasSubordinates) {
      const btnToggle = card.querySelector('.btn-toggle-staff');
      if (btnToggle) {
        btnToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded = card.classList.toggle('expanded-staff');
          const textSpan = btnToggle.querySelector('.btn-toggle-text');
          if (isExpanded) {
            textSpan.innerHTML = `<i class="fi fi-rr-angle-small-up"></i> Ocultar (${staff.length})`;
            btnToggle.classList.add('active');
          } else {
            textSpan.innerHTML = `<i class="fi fi-rr-users-alt"></i> ${staffCountLabel} <i class="fi fi-rr-angle-small-down"></i>`;
            btnToggle.classList.remove('active');
          }
        });
      }
    }

    card.addEventListener('click', () => {
      openSectorDrawer(sector.id);
    });

    wrapper.appendChild(card);

    // Children branches
    let children = state.sectores.filter(s => s.parent_id === sector.id);

    // Official order under sec-snaf: informatica before rrhh, and both Direcciones at the end (dir-ninez anteúltima, dir-dispositivos última)
    if (sector.id === 'sec-snaf') {
      const topOrder = {
        'despacho-general': 1,
        'informatica': 2,
        'rrhh': 3,
        'prensa': 4,
        'planificacion': 5,
        'coord-adm': 6,
        'coord-entornos': 7,
        'dir-ninez': 90,
        'dir-dispositivos': 91
      };
      children.sort((a, b) => (topOrder[a.id] || 50) - (topOrder[b.id] || 50));
    }

    if (children.length > 0) {
      const toggleContainer = document.createElement('div');
      toggleContainer.className = 'toggle-btn-container';

      const toggleBtn = document.createElement('button');
      toggleBtn.className = `card-collapse-toggle ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`;

      const childNames = children.map(c => {
        let n = (c.nombre || '').trim();
        n = n.replace(/\s*\(Línea 102\)/i, '');
        return n;
      }).filter(Boolean).join(' / ');

      let label = children.length === 1
        ? `1 Área (${childNames})`
        : `${children.length} Áreas (${childNames})`;

      if (sector.id === 'sec-snaf') label = `${children.length} Áreas Principales`;
      else if (sector.id === 'oficinas-opd') label = `${children.length} Oficinas de Protección de Derechos (OPD)`;
      else if (sector.id === 'disp-cuidado-comunitario' && children.length > 4) label = `${children.length} Dependencias (SEDE + CDIs / CDDs)`;
      else if (sector.id === 'coord-adm' && children.length > 4) label = `${children.length} Áreas Administrativas`;
      else if (sector.id === 'dir-ninez' && children.length > 4) label = `${children.length} Coordinaciones y Áreas`;
      else if (sector.id === 'dir-dispositivos' && children.length > 4) label = `${children.length} Áreas y Coordinaciones de Cuidados`;

      if (isCollapsed) {
        toggleBtn.innerHTML = `
          <i class="fi fi-rr-plus" style="font-size: 10px;"></i>
          <span>${label}</span>
        `;
        toggleBtn.title = `Clic para ver ${label}`;
      } else {
        toggleBtn.innerHTML = `
          <i class="fi fi-rr-minus" style="font-size: 10px;"></i>
          <span>Colapsar</span>
        `;
        toggleBtn.title = 'Colapsar esta rama';
      }

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isCollapsed) collapsedNodes.delete(sector.id);
        else collapsedNodes.add(sector.id);
        renderOrganigram(false);
      });

      toggleContainer.appendChild(toggleBtn);
      wrapper.appendChild(toggleContainer);

      // Render branch if not collapsed
      if (!isCollapsed) {
        const branch = document.createElement('div');
        branch.className = 'tree-branch';

        // Vertical stem line dropping from toggle button
        const stem = document.createElement('div');
        stem.className = 'tree-stem-line';
        branch.appendChild(stem);

        // Row of children
        const childrenRow = document.createElement('div');
        childrenRow.className = 'tree-children-row';

        children.forEach((child) => {
          const childCol = document.createElement('div');
          childCol.className = 'tree-child-col';

          // Connector header with real SVG arrow
          const connHeader = document.createElement('div');
          connHeader.className = 'child-connector-header';
          connHeader.innerHTML = `
            <div class="connector-bar-left"></div>
            <div class="connector-bar-right"></div>
            <div class="connector-drop-arrow">
              <svg width="14" height="26" viewBox="0 0 14 26">
                <line x1="7" y1="0" x2="7" y2="18" stroke="#0091ea" stroke-width="2" />
                <polygon points="2,16 12,16 7,24" fill="#0091ea" />
              </svg>
            </div>
          `;

          childCol.appendChild(connHeader);

          // Build child node recursively
          const childNodeEl = buildTreeNode(child);
          childCol.appendChild(childNodeEl);

          childrenRow.appendChild(childCol);
        });

        branch.appendChild(childrenRow);
        wrapper.appendChild(branch);
      }
    }

    return wrapper;
  }

  // ========================================================================
  // DRAWER: FICHA DEL SECTOR (SOLO LECTURA)
  // ========================================================================
  function getDrawerEncargados(sector) {
    if (!sector || !state.personal) return [];
    const resp = sector.responsable || '';
    if (isPlaceholderResp(resp)) return [];
    const parts = String(resp).split(/[\n/]+/).map(s => s.trim()).filter(Boolean);
    const encargados = [];
    const seen = new Set();
    const directPool = state.personal.filter(p => (p.sectores || []).some(a => a.sector_id === sector.id));

    parts.forEach(part => {
      if (isPlaceholderResp(part)) return;
      let matched = directPool.find(p => personMatchesSingleResp(p, part));
      if (!matched) {
        matched = state.personal.find(p => personMatchesSingleResp(p, part));
      }
      if (matched && !seen.has(matched.id)) {
        seen.add(matched.id);
        encargados.push(matched);
      }
    });

    return encargados;
  }

  function openSectorDrawer(sectorId) {
    activeDrawerSectorId = sectorId;
    const sector = getSectorById(sectorId);
    const drawer = document.getElementById('drawer-sector');
    if (!sector || !drawer) return;

    const cleanDrawerResp = (sector.responsable && !isPlaceholderResp(sector.responsable)) ? sector.responsable.trim() : '';
    document.getElementById('drawer-sector-type').textContent = sector.tipo || 'Sector';
    document.getElementById('drawer-sector-name').textContent = sector.nombre;
    document.getElementById('drawer-sector-desc').textContent = sector.descripcion || '';

    const authContainer = document.getElementById('drawer-authority-container');
    const encargados = getDrawerEncargados(sector);

    if (authContainer) {
      if (encargados.length > 0) {
        authContainer.style.display = 'flex';
        authContainer.innerHTML = encargados.map(person => {
          const initials = getInitials((person.apellidos || '') + ' ' + (person.nombres || ''));
          const thisRole = (person.sectores || []).find(s => s.sector_id === sectorId) ||
                           (person.sectores || []).find(s => matchesSectorFilter({ sectores: [s] }, sectorId)) ||
                           (person.sectores || [])[0] || {};
          const otherSectors = (person.sectores || []).filter(s => s.sector_id !== thisRole.sector_id);
          const roleLabel = sector.cargo_responsable || thisRole?.funcion || person.profesion || 'Responsable';

          return `
            <div style="background: white; border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; transition: border-color 0.15s, box-shadow 0.15s;">
              <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; cursor: pointer;" onclick="window.SNAF_VIEWER.openViewPersonModal('${person.id}')" title="Clic para ver legajo completo del encargado">
                <div class="authority-avatar" style="width: 38px; height: 38px; font-size: 13.5px; flex-shrink: 0;">${initials}</div>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 13.5px; color: var(--slate-900);">
                    ${escapeHtml(person.apellidos)}, ${escapeHtml(person.nombres)}
                    ${person.is_multi_sector ? `<span title="Multi-sector" style="color: #f59e0b; margin-left: 4px;"><i class="fi fi-sr-star" style="font-size: 11px;"></i></span>` : ''}
                  </div>
                  <div style="font-size: 11.5px; color: #0284c7; font-weight: 600;">
                    ${escapeHtml(roleLabel)}
                  </div>
                  ${person.correo ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(person.correo)}</div>` : ''}
                  ${otherSectors.length > 0 ? `
                    <div style="margin-top: 5px; font-size: 10.5px; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                      <i class="fi fi-sr-star" style="font-size: 10px; margin-right: 3px;"></i>Cumple funciones también en: ${otherSectors.map(o => escapeHtml(o.sector_nombre)).join(' + ')}
                    </div>
                  ` : ''}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                <button class="btn btn-outline btn-sm" onclick="window.SNAF_VIEWER.openViewPersonModal('${person.id}')" title="Ver ficha completa del encargado" style="padding: 5px 10px; font-size: 12px; font-weight: 600; background: white;">
                  <i class="fi fi-rr-eye" style="font-size: 12px;"></i> Ver Ficha
                </button>
              </div>
            </div>
          `;
        }).join('');
      } else if (cleanDrawerResp) {
        authContainer.style.display = 'flex';
        authContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="authority-avatar" style="width: 38px; height: 38px; font-size: 14px;">
              ${escapeHtml(getInitials(cleanDrawerResp))}
            </div>
            <div>
              <div style="font-size: 13.5px; font-weight: 700;">${escapeHtml(cleanDrawerResp)}</div>
              <div style="font-size: 11.5px; color: var(--slate-500);">${escapeHtml(sector.cargo_responsable || 'Responsable')}</div>
            </div>
          </div>
        `;
      } else {
        authContainer.style.display = 'none';
        authContainer.innerHTML = '';
      }
    }

    // OPD Extra Info
    const opdExtra = document.getElementById('drawer-opd-extra-info');
    if (sector.num_opd && opdExtra) {
      opdExtra.style.display = 'block';
      opdExtra.innerHTML = `
        ${sector.direccion ? `<div><strong><i class="fi fi-rr-marker" style="font-size: 11px;"></i> Sede:</strong> ${escapeHtml(sector.direccion)}</div>` : ''}
        ${sector.horario ? `<div><strong><i class="fi fi-rr-clock" style="font-size: 11px;"></i> Horario:</strong> ${escapeHtml(sector.horario)}</div>` : ''}
        ${sector.telefono_guardia ? `<div><strong><i class="fi fi-rr-phone-call" style="font-size: 11px;"></i> Guardia WIN:</strong> ${escapeHtml(sector.telefono_guardia)}</div>` : ''}
        ${sector.cobertura ? `<div><strong><i class="fi fi-rr-map" style="font-size: 11px;"></i> Cobertura:</strong> ${escapeHtml(sector.cobertura)}</div>` : ''}
      `;
    } else if (opdExtra) {
      opdExtra.style.display = 'none';
    }

    // Personnel in Sector
    const staff = getPersonnelInSector(sectorId);
    document.getElementById('drawer-staff-count').textContent = staff.length;

    const listEl = document.getElementById('drawer-staff-list');
    if (staff.length === 0) {
      listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px;">No hay personal asignado actualmente a este sector.</div>`;
    } else {
      listEl.innerHTML = staff.map(person => {
        const initials = getInitials(person.apellidos + ' ' + person.nombres);
        const thisRole = person.sectores.find(s => s.sector_id === sectorId) ||
                         person.sectores.find(s => matchesSectorFilter({ sectores: [s] }, sectorId)) ||
                         person.sectores[0] || {};
        const otherSectors = person.sectores.filter(s => s.sector_id !== thisRole.sector_id);

        return `
          <div style="background: white; border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; transition: border-color 0.15s, box-shadow 0.15s;">
            <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; cursor: pointer;" onclick="window.SNAF_VIEWER.openViewPersonModal('${person.id}')" title="Clic para ver legajo completo">
              <div class="person-avatar" style="width: 36px; height: 36px; font-size: 13px;">${initials}</div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 13.5px; color: var(--slate-900);">
                  ${escapeHtml(person.apellidos)}, ${escapeHtml(person.nombres)}
                  ${person.is_multi_sector ? `<span title="Multi-sector" style="color: #f59e0b; margin-left: 4px;"><i class="fi fi-sr-star" style="font-size: 11px;"></i></span>` : ''}
                </div>
                <div style="font-size: 12px; color: #0284c7; font-weight: 600;">
                  ${escapeHtml(thisRole?.funcion || person.profesion || 'Personal')}
                  ${(thisRole?.condicion && thisRole.condicion !== thisRole.funcion && !(thisRole?.funcion || '').toLowerCase().includes((thisRole.condicion || '').toLowerCase()) && !(thisRole.condicion || '').toLowerCase().includes((thisRole?.funcion || '').toLowerCase())) ? `<span style="font-weight: normal; color: #64748b;">(${escapeHtml(thisRole.condicion)})</span>` : ''}
                </div>
                ${person.correo ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(person.correo)}</div>` : ''}

                ${otherSectors.length > 0 ? `
                  <div style="margin-top: 6px; font-size: 10.5px; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                    <i class="fi fi-sr-star" style="font-size: 10px; margin-right: 3px;"></i>Cumple funciones también en: ${otherSectors.map(o => escapeHtml(o.sector_nombre)).join(' + ')}
                  </div>
                ` : ''}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <button class="btn btn-outline btn-sm" onclick="window.SNAF_VIEWER.openViewPersonModal('${person.id}')" title="Ver ficha completa de este agente" style="padding: 5px 10px; font-size: 12px; font-weight: 600;">
                <i class="fi fi-rr-eye" style="font-size: 12px;"></i> Ver Ficha
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    drawer.classList.add('active');
  }

  function closeSectorDrawer() {
    const drawer = document.getElementById('drawer-sector');
    if (drawer) drawer.classList.remove('active');
    activeDrawerSectorId = null;
  }

  // ========================================================================
  // MODAL: VER FICHA / DATOS DEL PERSONAL (SOLO LECTURA)
  // ========================================================================
  function openViewPersonModal(personId) {
    if (!personId) return;
    const person = state.personal.find(p => p.id === personId);
    if (!person) return;
    activeViewingPersonId = personId;

    const modal = document.getElementById('modal-view-person');
    if (!modal) return;

    // Header info
    const initials = getInitials((person.apellidos || '') + ' ' + (person.nombres || ''));
    const avatarEl = document.getElementById('vp-avatar');
    if (avatarEl) avatarEl.textContent = initials;

    const nombreEl = document.getElementById('vp-nombre-completo');
    if (nombreEl) nombreEl.textContent = `${person.apellidos || ''}, ${person.nombres || ''}`;

    const multiBadge = document.getElementById('vp-multi-badge');
    if (multiBadge) {
      const isMulti = person.is_multi_sector || (person.sectores && person.sectores.length > 1);
      multiBadge.style.display = isMulti ? 'inline-block' : 'none';
    }

    const profHeaderEl = document.getElementById('vp-profesion-header');
    if (profHeaderEl) profHeaderEl.textContent = person.profesion || 'Sin profesión registrada';

    const cuilHeaderEl = document.getElementById('vp-cuil-header');
    if (cuilHeaderEl) cuilHeaderEl.textContent = person.cuil || 'S/D';

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val && String(val).trim()) ? String(val).trim() : 'No registrado';
    };

    // Section 1: Contacto y Revista
    setText('vp-cuil', person.cuil);
    setText('vp-profesion', person.profesion);
    setText('vp-matricula', person.matricula);
    setText('vp-sit-revista', person.sit_revista);
    setText('vp-correo', person.correo);
    setText('vp-telefono', person.telefono);
    setText('vp-horario', person.horario);

    // Section 2: GDE & Capacitaciones
    setText('vp-gde-user', person.usuario_gde);

    const permisosEl = document.getElementById('vp-gde-permisos');
    if (permisosEl) {
      const perms = [];
      if (person.caratulador) perms.push('<i class="fi fi-rr-folder" style="font-size: 12px;"></i> Caratulador');
      if (person.asignador) perms.push('<i class="fi fi-rr-upload" style="font-size: 12px;"></i> Asignador');
      permisosEl.innerHTML = perms.length > 0 ? perms.join(' &middot; ') : 'Ninguno asignado';
    }

    setText('vp-gde-cap', person.capacitacion_gde);
    setText('vp-gde-mod', person.modalidad_capacitacion);
    setText('vp-gde-calif', person.calificaciones_virtual);
    setText('vp-gde-asist', person.asistencia_presencial);
    setText('vp-obs', person.observaciones_generales);

    // Section 3: Sectores y Funciones Asignadas
    const sectorsContainer = document.getElementById('vp-sectors-container');
    const sectorsBadge = document.getElementById('vp-sectors-count-badge');
    const assignedSectors = person.sectores || [];

    if (sectorsBadge) {
      sectorsBadge.textContent = `${assignedSectors.length} ${assignedSectors.length === 1 ? 'Sector' : 'Sectores'}`;
    }

    if (sectorsContainer) {
      if (assignedSectors.length === 0) {
        sectorsContainer.innerHTML = '<div style="color: #64748b; font-size: 13px; font-style: italic; padding: 12px; background: white; border-radius: 8px; border: 1px dashed #cbd5e1;">Sin sectores asignados actualmente.</div>';
      } else {
        sectorsContainer.innerHTML = assignedSectors.map((s, idx) => {
          const secObj = getSectorById(s.sector_id);
          const secNombre = secObj ? secObj.nombre : (s.sector_nombre || s.sector_id);
          const secTipo = secObj ? (secObj.tipo || 'Sector') : 'Sector';
          return `
            <div style="background: white; border: 1px solid var(--border-color); border-left: 4px solid var(--primary-color); border-radius: 8px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                <div>
                  <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">${idx + 1}. ${escapeHtml(secTipo)}</span>
                  <div style="font-weight: 700; color: var(--slate-900); font-size: 14.5px; margin-top: 2px;">
                    ${escapeHtml(secNombre)}
                  </div>
                </div>
                <span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 600; font-size: 11px; padding: 4px 8px;">
                  ${escapeHtml(s.condicion || 'Titular')}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 12.5px; color: var(--slate-700); background: #f8fafc; padding: 10px 12px; border-radius: 6px;">
                <div><strong>Función / Rol:</strong> <span style="color: #0284c7; font-weight: 600;">${escapeHtml(s.funcion || 'Administrativo')}</span></div>
                <div><strong>Superior Inmediato:</strong> ${escapeHtml(s.superior_inmediato || 'No especificado')}</div>
                ${s.observaciones ? `<div style="grid-column: 1 / -1; color: #475569; font-size: 12px; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 2px;"><strong>Observaciones del Sector:</strong> ${escapeHtml(s.observaciones)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    modal.classList.add('active');
  }

  function closeViewPersonModal() {
    const modal = document.getElementById('modal-view-person');
    if (modal) modal.classList.remove('active');
    activeViewingPersonId = null;
  }

  // ========================================================================
  // HELPERS
  // ========================================================================
  function matchesSectorFilter(person, sectorId) {
    if (!person || !person.sectores || !Array.isArray(person.sectores)) return false;
    return person.sectores.some(s => {
      if (s.sector_id === sectorId) return true;
      if (sectorId === 'coord-opd') {
        return s.sector_id === 'coord-opd' ||
               s.sector_id === 'oficinas-opd' ||
               s.sector_id === 'despacho-coord-opd' ||
               s.sector_id.startsWith('opd-');
      }
      if (sectorId === 'oficinas-opd') {
        return s.sector_id === 'oficinas-opd' ||
               s.sector_id.startsWith('opd-');
      }
      if (sectorId === 'linea-102') {
        return s.sector_id === 'linea-102-equipo-tecnico' ||
               s.sector_id === 'linea-102-operadores' ||
               s.sector_id === 'linea-102-administracion';
      }
      if (sectorId === 'despacho-general') {
        return s.sector_id === 'despacho-general' ||
               s.sector_id === 'despacho-tramite' ||
               s.sector_id === 'mesa-entrada' ||
               s.sector_id === 'sec-privada' ||
               s.sector_id === 'despacho-archivo';
      }
      if (sectorId === 'disp-cuidado-comunitario') {
        return s.sector_id === 'disp-cuidado-comunitario' ||
               s.sector_id === 'sede-dpdc' ||
               s.sector_id.startsWith('cdi-') ||
               s.sector_id.startsWith('cdd-');
      }
      if (sectorId === 'sist-cuidados-alternativos') {
        return s.sector_id === 'sist-cuidados-alternativos' ||
               s.sector_id === 'cuidados-modalidad-familiar' ||
               s.sector_id === 'prog-familia-ampliada' ||
               s.sector_id === 'prog-familias-cuidan' ||
               s.sector_id === 'cuidados-modalidad-residencial' ||
               s.sector_id === 'coord-casa-nino' ||
               s.sector_id === 'coord-casa-adolescente';
      }
      if (sectorId === 'cuidados-modalidad-familiar') {
        return s.sector_id === 'cuidados-modalidad-familiar' ||
               s.sector_id === 'prog-familia-ampliada' ||
               s.sector_id === 'prog-familias-cuidan';
      }
      if (sectorId === 'cuidados-modalidad-residencial') {
        return s.sector_id === 'cuidados-modalidad-residencial' ||
               s.sector_id === 'coord-casa-nino' ||
               s.sector_id === 'coord-casa-adolescente';
      }
      if (sectorId === 'sistema-penal-juvenil') {
        return s.sector_id === 'sistema-penal-juvenil' ||
               s.sector_id === 'penal-no-privativas' ||
               s.sector_id === 'penal-privativas' ||
               s.sector_id === 'penal-modalidad-alojamiento' ||
               s.sector_id === 'penal-modalidad-territorio' ||
               s.sector_id === 'dappa' ||
               s.sector_id === 'mpt' ||
               s.sector_id === 'cad' ||
               s.sector_id === 'centro-san-pedro' ||
               s.sector_id === 'centro-alto-comedero';
      }
      if (sectorId === 'penal-no-privativas' || sectorId === 'penal-modalidad-territorio') {
        return s.sector_id === 'penal-no-privativas' ||
               s.sector_id === 'penal-modalidad-territorio' ||
               s.sector_id === 'dappa' ||
               s.sector_id === 'mpt';
      }
      if (sectorId === 'penal-privativas' || sectorId === 'penal-modalidad-alojamiento') {
        return s.sector_id === 'penal-privativas' ||
               s.sector_id === 'penal-modalidad-alojamiento' ||
               s.sector_id === 'cad' ||
               s.sector_id === 'centro-san-pedro' ||
               s.sector_id === 'centro-alto-comedero';
      }
      if (sectorId === 'cad') {
        return s.sector_id === 'cad' ||
               s.sector_id === 'centro-san-pedro' ||
               s.sector_id === 'centro-alto-comedero';
      }
      return false;
    });
  }

  function normText(s) {
    if (!s) return '';
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function cleanRespName(resp) {
    let r = normText(resp);
    ['dra. ', 'dr. ', 'lic. ', 'ing. ', 'prof. ', 'abog. ', 'tec. '].forEach(t => {
      r = r.split(t).join('');
    });
    return r.replace(/\[.*?\]|\(.*?\)/g, '').trim();
  }

  function isPlaceholderResp(resp) {
    const r = normText(resp);
    if (!r) return true;
    const placeholders = [
      'a designar', 'sin abogado', 'equipo interdisciplinario',
      'guardia telefonica', 'equipo tecnico', 'coordinadores de casas'
    ];
    return placeholders.some(ph => r.includes(ph));
  }

  function personMatchesSingleResp(person, singleResp) {
    if (!person || !singleResp || isPlaceholderResp(singleResp)) return false;
    const r = cleanRespName(singleResp);
    if (!r) return false;
    const apTokens = normText(person.apellidos || '').split(/\s+/).filter(t => t.length > 2);
    const nomTokens = normText(person.nombres || '').split(/\s+/).filter(t => t.length > 2);
    if (apTokens.length === 0) return false;
    const apMatch = apTokens.some(at => r.includes(at));
    const nomMatch = nomTokens.length > 0 ? nomTokens.some(nt => r.includes(nt)) : true;
    return apMatch && nomMatch;
  }

  function personMatchesResp(person, respStr) {
    if (!person || !respStr || isPlaceholderResp(respStr)) return false;
    const parts = String(respStr).split(/[\n/]+/).map(s => s.trim()).filter(Boolean);
    return parts.some(part => personMatchesSingleResp(person, part));
  }

  function getAncestorResponsables(sector) {
    const resps = [];
    let curr = sector && sector.parent_id ? getSectorById(sector.parent_id) : null;
    while (curr) {
      if (curr.responsable && !isPlaceholderResp(curr.responsable)) {
        resps.push(curr.responsable);
      }
      curr = curr.parent_id ? getSectorById(curr.parent_id) : null;
    }
    resps.push('Dra. Marta Laura Iriarte Duberti');
    return resps;
  }

  function sameRespIdentity(respA, respB) {
    const a = cleanRespName(respA);
    const b = cleanRespName(respB);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes('iriarte') && b.includes('iriarte')) return true;
    if (a.includes('vacaflor') && b.includes('vacaflor')) return true;
    if (a.includes('chara') && b.includes('chara')) return true;
    if (a.includes('gloss') && b.includes('gloss')) return true;
    if (a.includes('alancay') && b.includes('alancay') && a.includes('delia') && b.includes('delia')) return true;
    if (a.includes('alancay') && b.includes('alancay') && a.includes('nancy') && b.includes('nancy')) return true;
    return false;
  }

  function getSectorOwnEncargados(sector) {
    if (!sector || !state.personal) return [];
    const resp = sector.responsable || '';
    if (isPlaceholderResp(resp)) return [];
    const ancResps = getAncestorResponsables(sector);
    const parts = String(resp).split(/[\n/]+/).map(s => s.trim()).filter(Boolean);
    const encargados = [];
    const seen = new Set();

    const directPool = state.personal.filter(p => (p.sectores || []).some(a => a.sector_id === sector.id));

    parts.forEach(part => {
      if (isPlaceholderResp(part)) return;
      if (ancResps.some(ar => sameRespIdentity(part, ar))) return;

      let matched = directPool.find(p => personMatchesSingleResp(p, part));
      if (!matched) {
        matched = state.personal.find(p => personMatchesSingleResp(p, part));
      }
      if (matched && !seen.has(matched.id)) {
        seen.add(matched.id);
        encargados.push(matched);
      }
    });

    return encargados;
  }

  // Returns ONLY the direct subordinate users ("usuarios hijos") of the given sector's authority/encargado
  function getPersonnelInSector(sectorId) {
    if (!state.personal || !state.sectores) return [];
    const sector = getSectorById(sectorId);
    if (!sector) return [];

    const result = [];
    const seenIds = new Set();
    const addPerson = (p) => {
      if (p && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        result.push(p);
      }
    };

    const cardRespName = sector.id === 'sec-snaf' ? 'Dra. Marta Laura Iriarte Duberti' : (sector.responsable || '');
    const excludedResps = [...getAncestorResponsables(sector), cardRespName].filter(Boolean);
    const isExcludedHead = (p) => excludedResps.some(r => personMatchesResp(p, r));

    // 1. Direct staff of this sector (excluding the sector's own encargado/head)
    state.personal.forEach(p => {
      if ((p.sectores || []).some(a => a.sector_id === sector.id)) {
        if (!isExcludedHead(p)) {
          addPerson(p);
        }
      }
    });

    // 2. Child sectors: if child has an encargado, include ONLY that encargado; otherwise include child's subordinates
    let children = state.sectores.filter(c => c.parent_id === sector.id);
    if (sector.id === 'sec-snaf') {
      const topOrder = {
        'despacho-general': 1,
        'informatica': 2,
        'rrhh': 3,
        'prensa': 4,
        'planificacion': 5,
        'coord-adm': 6,
        'coord-entornos': 7,
        'dir-ninez': 90,
        'dir-dispositivos': 91
      };
      children.sort((a, b) => (topOrder[a.id] || 50) - (topOrder[b.id] || 50));
    }

    children.forEach(ch => {
      const chEncargados = getSectorOwnEncargados(ch);
      if (chEncargados.length > 0) {
        chEncargados.forEach(enc => {
          if (!isExcludedHead(enc)) addPerson(enc);
        });
      } else {
        getPersonnelInSector(ch.id).forEach(subP => {
          if (!isExcludedHead(subP)) addPerson(subP);
        });
      }
    });

    if (sectorId === 'informatica') {
      result.sort((a, b) => {
        const aIsDario = (a.apellidos || '').toUpperCase().includes('ORQUERA') || (a.nombres || '').toUpperCase().includes('DARIO') || (a.nombres || '').toUpperCase().includes('DARÍO');
        const bIsDario = (b.apellidos || '').toUpperCase().includes('ORQUERA') || (b.nombres || '').toUpperCase().includes('DARIO') || (b.nombres || '').toUpperCase().includes('DARÍO');
        if (aIsDario && !bIsDario) return -1;
        if (!aIsDario && bIsDario) return 1;
        return 0;
      });
    }

    return result;
  }

  function getSectorById(sectorId) {
    return state.sectores.find(s => s.id === sectorId);
  }

  function getDynamicSectorLevel(sector) {
    if (!sector || sector.id === 'sec-snaf' || !sector.parent_id) return 0;
    let level = 0;
    let curr = sector;
    const visited = new Set();
    while (curr && curr.parent_id && !visited.has(curr.id)) {
      visited.add(curr.id);
      level++;
      curr = getSectorById(curr.parent_id);
    }
    return level;
  }

  function toTitleCase(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(w => {
        if (/^(opd|cad|pae|snaf|i|ii|iii|iv|v|vi)$/i.test(w)) return w.toUpperCase();
        if (/^(de|del|la|las|los|y|e)$/i.test(w)) return w.toLowerCase();
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }

  function formatPersonName(p) {
    if (!p) return '';
    if (typeof p === 'string') {
      const trimmed = p.trim();
      return trimmed === trimmed.toUpperCase() ? toTitleCase(trimmed) : trimmed;
    }
    const nom = (p.nombres || '').trim();
    const ape = (p.apellidos || '').trim();
    if (nom && ape) {
      const full = `${nom} ${ape}`;
      return full === full.toUpperCase() ? toTitleCase(full) : full;
    }
    const single = nom || ape || '';
    return single === single.toUpperCase() ? toTitleCase(single) : single;
  }

  function getInitials(name) {
    if (!name) return 'SN';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Global API
  window.SNAF_VIEWER = {
    openSectorDrawer,
    closeSectorDrawer,
    openViewPersonModal,
    closeViewPersonModal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
