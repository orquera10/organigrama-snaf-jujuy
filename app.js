/**
 * SNAF - SISTEMA DE ORGANIGRAMA Y GESTIÓN DE DOTACIÓN
 * Gobierno de la Provincia de Jujuy
 * Lógica de la Aplicación y Manejo de Estado
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'SNAF_ORGANIGRAMA_STATE_V19';

  // Application State
  let state = {
    institucion: {},
    sectores: [],
    personal: []
  };

  // UI state
  let currentTab = 'organigrama';
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

  // Personnel filter state
  let personalSearchQuery = '';
  let personalFilterType = 'all'; // all, multisector
  let personalFilterSector = 'all';
  let personalFilterGde = 'all';
  let personalFilterProf = 'all';
  let personalViewMode = 'table'; // table, cards
  let personalPage = 1;
  const personalPerPage = 15;

  // OPD filter state
  let opdRegionFilter = 'all';
  let opdSearchQuery = '';

  // Sector filter state
  let sectorSearchQuery = '';
  let sectorTypeFilter = 'all';

  // Currently opened sector in drawer
  let activeDrawerSectorId = null;
  let activeViewingPersonId = null;

  // ========================================================================
  // INITIALIZATION & STORAGE
  // ========================================================================
  function init() {
    // Redirect to public visor if accessed with ?readonly or ?mode=view
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('readonly') || urlParams.get('mode') === 'view' || urlParams.get('view') === 'public') {
      window.location.href = 'visor.html';
      return;
    }

    loadState();
    initCollapsedState(); // Always open with organigram collapsed to main areas!
    setupEventListeners();
    updateHeaderKPIs();
    populateSectorDropdowns();
    renderCurrentTab();
  }

  function initCollapsedState() {
    collapsedNodes.clear();
    // Collapse every sector that has children except root 'sec-snaf'
    // This lets the user see the ministerial cabinet and choose which area to explore!
    if (state.sectores) {
      state.sectores.forEach(s => {
        const hasChildren = state.sectores.some(c => c.parent_id === s.id);
        if (hasChildren && s.id !== 'sec-snaf') {
          collapsedNodes.add(s.id);
        }
      });
    }
  }

  function loadState() {
    try {
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V1');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V2');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V3');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V4');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V5');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V6');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V7');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V8');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V9');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V10');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V11');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V12');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V13');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V14');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V15');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V16');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V17');
      localStorage.removeItem('SNAF_ORGANIGRAMA_STATE_V18');

      if (window.SERVER_ORGANIGRAMA_DATA && window.SERVER_ORGANIGRAMA_DATA.sectores) {
        state = JSON.parse(JSON.stringify(window.SERVER_ORGANIGRAMA_DATA));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        console.log('[Django Backend] Estado cargado exitosamente desde la base de datos del servidor');
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          state = JSON.parse(saved);
          console.log('Loaded state from localStorage');
        } else if (window.INITIAL_ORGANIGRAMA_DATA) {
          state = JSON.parse(JSON.stringify(window.INITIAL_ORGANIGRAMA_DATA));
          saveState(false);
          console.log('Loaded state from initialData.js');
        }
      }
    } catch (e) {
      console.error('Error loading state, using fallback:', e);
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
        dario.observaciones_generales = 'Personal Técnico del área de Informática';
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
        magana.observaciones_generales = 'Personal Técnico del área de Informática / Referente GDE';
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

  function saveState(showVisual = true) {
    try {
      // Re-evaluate multi-sector flags
      state.personal.forEach(p => {
        p.is_multi_sector = Array.isArray(p.sectores) && p.sectores.length > 1;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateHeaderKPIs();

      // Sincronización transparente con base de datos Django
      if (typeof window !== 'undefined' && window.fetch) {
        fetch('/api/state/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        }).then(r => r.json()).then(data => {
          console.log('[Django API] Sincronizado en servidor:', data);
          const pill = document.getElementById('auto-save-pill');
          if (pill && showVisual) {
            pill.innerHTML = '<span class="status-dot"></span><span>Sincronizado con servidor</span>';
          }
        }).catch(err => {
          console.log('[Django API] Modo local/offline:', err);
        });
      }

      if (showVisual) {
        const pill = document.getElementById('auto-save-pill');
        if (pill) {
          pill.innerHTML = '<span class="status-dot"></span><span>Cambios guardados</span>';
          pill.classList.add('saved');
          setTimeout(() => {
            pill.innerHTML = '<span class="status-dot"></span><span>Guardado local activo</span>';
          }, 2500);
        }
      }
    } catch (e) {
      console.error('Error saving state:', e);
      showToast('Error al guardar en almacenamiento local', 'error');
    }
  }

  function resetState() {
    if (confirm('¿Está seguro de restablecer todos los datos a la nómina inicial original? Se perderán las modificaciones no respaldadas.')) {
      if (window.INITIAL_ORGANIGRAMA_DATA) {
        state = JSON.parse(JSON.stringify(window.INITIAL_ORGANIGRAMA_DATA));
        saveState();
        populateSectorDropdowns();
        renderCurrentTab();
        showToast('Datos restablecidos a la nómina inicial correctamente.', 'success');
      }
    }
  }

  // ========================================================================
  // HEADER KPIS & METRICS
  // ========================================================================
  function updateHeaderKPIs() {
    const totalPersonal = state.personal.length;
    const totalSectores = state.sectores.length;
    const multiSectorCount = state.personal.filter(p => p.is_multi_sector).length;
    
    // GDE completed: modalida virtual + presencial or SI
    const gdeCompleted = state.personal.filter(p => {
      const cap = (p.capacitacion_gde || '').toUpperCase();
      const mod = (p.modalidad_capacitacion || '').toLowerCase();
      return cap === 'SI' || mod.includes('presencial') || mod.includes('virtual + presencial');
    }).length;

    const gdePct = totalPersonal > 0 ? Math.round((gdeCompleted / totalPersonal) * 100) : 0;

    const elTotalP = document.getElementById('kpi-total-personal');
    const elTotalS = document.getElementById('kpi-total-sectores');
    const elMulti = document.getElementById('kpi-multi-sector');
    const elGde = document.getElementById('kpi-gde-cap');
    const elNavP = document.getElementById('nav-count-personal');
    const elNavS = document.getElementById('nav-count-sectores');
    const elFilterMultiCount = document.getElementById('filter-multi-count');

    if (elTotalP) elTotalP.textContent = totalPersonal;
    if (elTotalS) elTotalS.textContent = totalSectores;
    if (elMulti) elMulti.textContent = multiSectorCount;
    if (elGde) elGde.textContent = gdePct + '%';
    if (elNavP) elNavP.textContent = totalPersonal;
    if (elNavS) elNavS.textContent = totalSectores;
    if (elFilterMultiCount) elFilterMultiCount.textContent = multiSectorCount;

    // Dashboard metrics
    const dashTotA = document.getElementById('dash-total-agents');
    const dashTotS = document.getElementById('dash-total-sectors');
    const dashMulti = document.getElementById('dash-multi-sector');
    const dashGde = document.getElementById('dash-gde-pct');
    if (dashTotA) dashTotA.textContent = totalPersonal;
    if (dashTotS) dashTotS.textContent = totalSectores;
    if (dashMulti) dashMulti.textContent = multiSectorCount;
    if (dashGde) dashGde.textContent = gdePct + '%';
  }

  // ========================================================================
  // NAVIGATION & TAB SWITCHING
  // ========================================================================
  function setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    // DB Dropdown Menu
    const dbBtn = document.getElementById('btn-db-menu-toggle');
    const dbMenu = document.getElementById('db-dropdown-menu');
    if (dbBtn && dbMenu) {
      dbBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dbMenu.style.display = dbMenu.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', () => {
        dbMenu.style.display = 'none';
      });
    }

    // Export/Import/Reset actions
    const btnCopyPublic = document.getElementById('btn-copy-public-link');
    if (btnCopyPublic) {
      btnCopyPublic.addEventListener('click', () => {
        const publicUrl = new URL('visor.html', window.location.href).href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(publicUrl).then(() => {
            showToast('Enlace de consulta pública copiado al portapapeles.', 'success');
          }).catch(() => {
            prompt('Copia este enlace de consulta:', publicUrl);
          });
        } else {
          prompt('Copia este enlace de consulta:', publicUrl);
        }
      });
    }

    const btnExpJson = document.getElementById('btn-export-json');
    if (btnExpJson) btnExpJson.addEventListener('click', exportJSON);

    const btnExpCsv = document.getElementById('btn-export-csv');
    if (btnExpCsv) btnExpCsv.addEventListener('click', exportCSV);

    const fileImpJson = document.getElementById('file-import-json');
    if (fileImpJson) fileImpJson.addEventListener('change', importJSON);

    const btnReset = document.getElementById('btn-reset-db');
    if (btnReset) btnReset.addEventListener('click', resetState);

    // Header buttons
    const btnNewPHeader = document.getElementById('btn-header-new-person');
    if (btnNewPHeader) btnNewPHeader.addEventListener('click', () => openPersonModal(null));

    const btnNewSHeader = document.getElementById('btn-header-new-sector');
    if (btnNewSHeader) btnNewSHeader.addEventListener('click', () => openSectorModal(null));

    const btnNewPToolbar = document.getElementById('btn-create-person-toolbar');
    if (btnNewPToolbar) btnNewPToolbar.addEventListener('click', () => openPersonModal(null));

    const btnNewSSectores = document.getElementById('btn-create-sector-view');
    if (btnNewSSectores) btnNewSSectores.addEventListener('click', () => openSectorModal(null));

    // Organigram Controls
    setupOrganigramControls();

    // OPD Controls
    setupOPDControls();

    // Personnel Controls
    setupPersonnelControls();

    // Sector Controls
    setupSectorControls();

    // Modals & Drawer close
    setupModalsAndDrawer();
  }

  function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tabId}`);
    });
    renderCurrentTab();
  }

  function renderCurrentTab() {
    if (currentTab === 'organigrama') renderOrganigram();
    else if (currentTab === 'opds') renderOPDs();
    else if (currentTab === 'personal') renderPersonnel();
    else if (currentTab === 'sectores') renderSectors();
    else if (currentTab === 'dashboard') renderDashboard();
  }

  // ========================================================================
  // HELPER: SECTOR PERSONNEL MAPPING
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

  function getDirectPersonnelInSector(sectorId) {
    if (!state.personal) return [];
    return state.personal.filter(p => (p.sectores || []).some(s => s.sector_id === sectorId));
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
        'dir-ninez': 7,
        'dir-dispositivos': 8
      };
      children.sort((a, b) => (topOrder[a.id] || 99) - (topOrder[b.id] || 99));
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

  // ========================================================================
  // TAB 1: ORGANIGRAMA INTERACTIVO (TREE RENDERER)
  // ========================================================================
  function setupOrganigramControls() {
    const viewport = document.getElementById('org-viewport');
    const canvas = document.getElementById('org-canvas');
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

    // Pan & Zoom
    if (viewport && canvas) {
      viewport.addEventListener('mousedown', (e) => {
        // Only pan if clicking on viewport background
        if (e.target.closest('.sector-card') || e.target.closest('.card-collapse-toggle') || e.target.closest('.control-btn')) return;
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
        isPanning = false;
        if (viewport) viewport.style.cursor = 'grab';
      });

      // Wheel Zoom
      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        adjustZoom(delta);
      }, { passive: false });
    }

    if (btnZoomIn) btnZoomIn.addEventListener('click', () => adjustZoom(0.12));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => adjustZoom(-0.12));
    if (btnZoomReset) btnZoomReset.addEventListener('click', () => {
      orgScale = 1;
      orgTranslateX = 0;
      orgTranslateY = 0;
      applyCanvasTransform();
    });
    if (btnFitFloating) btnFitFloating.addEventListener('click', () => {
      fitOrganigramToScreen();
      showToast('Organigrama centrado y ajustado a la pantalla.', 'info');
    });
    if (btnFitScreen) btnFitScreen.addEventListener('click', () => {
      fitOrganigramToScreen();
      showToast('Organigrama centrado y ajustado a la pantalla.', 'info');
    });

    if (btnMultiHigh) {
      btnMultiHigh.addEventListener('click', () => {
        highlightMultiSector = !highlightMultiSector;
        btnMultiHigh.classList.toggle('active', highlightMultiSector);
        renderOrganigram(false);
      });
    }

    if (btnExpandAll) {
      btnExpandAll.addEventListener('click', () => {
        collapsedNodes.clear();
        renderOrganigram(true);
      });
    }

    if (btnCollapseAll) {
      btnCollapseAll.addEventListener('click', () => {
        initCollapsedState();
        renderOrganigram(true);
        showToast('Organigrama colapsado a nivel de áreas principales.', 'info');
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        orgSearchQuery = e.target.value.trim().toLowerCase();
        renderOrganigram(false);
      });
    }

    if (filterRep) {
      filterRep.addEventListener('change', (e) => {
        orgFilterRep = e.target.value;
        renderOrganigram(true);
      });
    }

    window.addEventListener('resize', () => {
      if (currentTab === 'organigrama') {
        fitOrganigramToScreen();
      }
    });
  }

  function adjustZoom(delta) {
    orgScale = Math.min(Math.max(0.3, orgScale + delta), 2.0);
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

  function renderOrganigram(autoFit = true) {
    const canvas = document.getElementById('org-canvas');
    if (!canvas) return;

    // Filter sectors by selected branch if specified
    let rootId = 'sec-snaf';
    if (orgFilterRep !== 'all') {
      rootId = orgFilterRep;
    }

    const rootSector = state.sectores.find(s => s.id === rootId);
    if (!rootSector) {
      canvas.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">No se encontró el sector raíz del organigrama.</div>';
      return;
    }

    // Build tree recursively
    canvas.innerHTML = '';
    const treeContainer = document.createElement('div');
    treeContainer.className = 'org-tree';

    const rootNodeEl = buildTreeNode(rootSector);
    treeContainer.appendChild(rootNodeEl);
    canvas.appendChild(treeContainer);

    // If there's a search query, scroll to first highlighted node
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

    // Find personnel in this sector
    const staff = getPersonnelInSector(sector.id);

    // Sort staff in informatica to guarantee Dario Orquera is listed FIRST
    if (sector.id === 'informatica') {
      staff.sort((a, b) => {
        if (a.apellidos.includes('ORQUERA')) return -1;
        if (b.apellidos.includes('ORQUERA')) return 1;
        return 0;
      });
    }

    const multiSectorStaff = staff.filter(p => p.is_multi_sector);
    const isCollapsed = collapsedNodes.has(sector.id);

    // Check if matches search
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

    // Create Card
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
              <span class="btn-toggle-text"><i class="ph ph-users"></i> ${staffCountLabel} <i class="ph ph-caret-down"></i></span>
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
            textSpan.innerHTML = `<i class="ph ph-caret-up"></i> Ocultar (${staff.length})`;
            btnToggle.classList.add('active');
          } else {
            textSpan.innerHTML = `<i class="ph ph-users"></i> ${staffCountLabel} <i class="ph ph-caret-down"></i>`;
            btnToggle.classList.remove('active');
          }
        });
      }
    }

    // Click on card opens sector drawer
    card.addEventListener('click', () => {
      openSectorDrawer(sector.id);
    });

    wrapper.appendChild(card);

    // Find children sectors
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
        'dir-ninez': 7,
        'dir-dispositivos': 8
      };
      children.sort((a, b) => (topOrder[a.id] || 99) - (topOrder[b.id] || 99));
    }

    // If it has children: add toggle button and children branch
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
          <i class="ph ph-plus" style="font-size: 11px;"></i>
          <span>${label}</span>
        `;
        toggleBtn.title = `Clic para ver ${label}`;
      } else {
        toggleBtn.innerHTML = `
          <i class="ph ph-minus" style="font-size: 11px;"></i>
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
  // TAB 2: RED TERRITORIAL DE 30 OPDS
  // ========================================================================
  function setupOPDControls() {
    const regionFilters = document.getElementById('opd-region-filters');
    const searchInput = document.getElementById('opd-search-input');

    if (regionFilters) {
      regionFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('.region-pill');
        if (!btn) return;
        regionFilters.querySelectorAll('.region-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        opdRegionFilter = btn.getAttribute('data-region');
        renderOPDs();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        opdSearchQuery = e.target.value.trim().toLowerCase();
        renderOPDs();
      });
    }
  }

  function renderOPDs() {
    const container = document.getElementById('opd-cards-container');
    if (!container) return;

    // Filter OPDs (only sectors with num_opd)
    let opds = state.sectores.filter(s => s.num_opd !== undefined && s.num_opd !== null);
    opds.sort((a, b) => a.num_opd - b.num_opd);

    if (opdRegionFilter !== 'all') {
      opds = opds.filter(o => o.region === opdRegionFilter);
    }

    if (opdSearchQuery) {
      opds = opds.filter(o => {
        const staff = getDirectPersonnelInSector(o.id);
        const matchName = (o.nombre || '').toLowerCase().includes(opdSearchQuery);
        const matchResp = (o.responsable || '').toLowerCase().includes(opdSearchQuery);
        const matchLoc = (o.direccion || '').toLowerCase().includes(opdSearchQuery);
        const matchStaff = staff.some(p => (p.apellidos + ' ' + p.nombres).toLowerCase().includes(opdSearchQuery));
        return matchName || matchResp || matchLoc || matchStaff;
      });
    }

    if (opds.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #64748b; background: white; border-radius: 12px;">No se encontraron oficinas para los criterios seleccionados.</div>';
      return;
    }

    container.innerHTML = opds.map(opd => {
      const staff = getDirectPersonnelInSector(opd.id);
      const abogados = staff.filter(p => {
        const sRole = p.sectores.find(s => s.sector_id === opd.id);
        const f = (sRole?.funcion || p.profesion || '').toLowerCase();
        return f.includes('abogad');
      });

      const tsCount = staff.filter(p => (p.profesion || '').toLowerCase().includes('trabajo social') || (p.profesion || '').toLowerCase().includes('asistente social')).length;
      const psiCount = staff.filter(p => (p.profesion || '').toLowerCase().includes('psicolog')).length;
      const adminCount = staff.filter(p => (p.profesion || '').toLowerCase().includes('administrativ') || (p.profesion || '').toLowerCase().includes('operador')).length;

      // Legal status
      let legalHtml = '';
      if (abogados.length > 0) {
        const ab = abogados[0];
        const sRole = ab.sectores.find(s => s.sector_id === opd.id);
        const isItin = (sRole?.condicion || '').includes('Itinerante') || (sRole?.observaciones || '').includes('Itinerante');
        legalHtml = `
          <div class="opd-legal-badge ${isItin ? 'itinerant' : ''}">
            <i class="ph ph-identification-card" style="font-size: 15px;"></i>
            <div>
              <strong>${escapeHtml(ab.apellidos + ', ' + ab.nombres)}</strong>
              ${ab.matricula ? ` <span style="font-size: 10px; opacity: 0.8;">[${escapeHtml(ab.matricula)}]</span>` : ''}
              <div style="font-size: 10.5px; opacity: 0.85;">${isItin ? 'Abogado Itinerante (BIS)' : 'Abogado Titular'}</div>
            </div>
          </div>
        `;
      } else {
        legalHtml = `
          <div class="opd-legal-badge" style="background: #f1f5f9; color: #64748b;">
            <i class="ph ph-info" style="font-size: 15px;"></i>
            <span>Sin asesor legal asignado</span>
          </div>
        `;
      }

      return `
        <div class="opd-card" onclick="window.SNAF_APP.openSectorDrawer('${opd.id}')">
          <div>
            <div class="opd-card-header">
              <span class="opd-number-badge">OPD ${String(opd.num_opd).padStart(2, '0')}</span>
              <span class="region-tag">${escapeHtml(opd.region || 'Provincial')}</span>
            </div>

            <div class="opd-card-title">${escapeHtml(opd.nombre)}</div>

            ${opd.direccion ? `
              <div class="opd-detail-item">
                <i class="ph ph-map-pin" style="font-size: 14px;"></i>
                <span>${escapeHtml(opd.direccion)}</span>
              </div>
            ` : ''}

            ${opd.telefono_guardia && opd.telefono_guardia !== '-' ? `
              <div class="opd-detail-item">
                <i class="ph ph-phone" style="font-size: 14px;"></i>
                <span><strong>Guardia WIN:</strong> ${escapeHtml(opd.telefono_guardia)}</span>
              </div>
            ` : ''}

            ${legalHtml}

            <div class="opd-team-tags">
              ${tsCount > 0 ? `<span class="team-chip">${tsCount} Trab. Social</span>` : ''}
              ${psiCount > 0 ? `<span class="team-chip">${psiCount} Psicología</span>` : ''}
              ${adminCount > 0 ? `<span class="team-chip">${adminCount} Adm / Op</span>` : ''}
            </div>
          </div>

          <div class="opd-card-footer">
            <span><strong>${staff.length}</strong> Agentes Activos</span>
            <span style="display: flex; align-items: center; gap: 4px;">
              Ver Personal →
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ========================================================================
  // TAB 3: GESTIÓN DE PERSONAL & SECTORES (CORE REQUIREMENT)
  // ========================================================================
  function setupPersonnelControls() {
    const searchInput = document.getElementById('personnel-search-input');
    const filterSector = document.getElementById('filter-sector-dropdown');
    const filterGde = document.getElementById('filter-gde-status');
    const filterProf = document.getElementById('filter-profesion');
    const filterMulti = document.getElementById('btn-filter-multisector');
    const filterAllChips = document.querySelectorAll('.filter-chip-btn[data-filter]');

    const btnViewTable = document.getElementById('btn-view-table');
    const btnViewCards = document.getElementById('btn-view-cards');
    const btnPagPrev = document.getElementById('btn-pag-prev');
    const btnPagNext = document.getElementById('btn-pag-next');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        personalSearchQuery = e.target.value.trim().toLowerCase();
        personalPage = 1;
        renderPersonnel();
      });
    }

    if (filterSector) {
      filterSector.addEventListener('change', (e) => {
        personalFilterSector = e.target.value;
        personalPage = 1;
        renderPersonnel();
      });
    }

    if (filterGde) {
      filterGde.addEventListener('change', (e) => {
        personalFilterGde = e.target.value;
        personalPage = 1;
        renderPersonnel();
      });
    }

    if (filterProf) {
      filterProf.addEventListener('change', (e) => {
        personalFilterProf = e.target.value;
        personalPage = 1;
        renderPersonnel();
      });
    }

    if (filterAllChips) {
      filterAllChips.forEach(chip => {
        chip.addEventListener('click', () => {
          filterAllChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          personalFilterType = chip.getAttribute('data-filter');
          personalPage = 1;
          renderPersonnel();
        });
      });
    }

    if (btnViewTable && btnViewCards) {
      btnViewTable.addEventListener('click', () => {
        personalViewMode = 'table';
        btnViewTable.classList.add('active');
        btnViewCards.classList.remove('active');
        document.getElementById('personnel-table-wrapper').style.display = 'block';
        document.getElementById('personnel-grid-wrapper').style.display = 'none';
        renderPersonnel();
      });

      btnViewCards.addEventListener('click', () => {
        personalViewMode = 'cards';
        btnViewCards.classList.add('active');
        btnViewTable.classList.remove('active');
        document.getElementById('personnel-table-wrapper').style.display = 'none';
        document.getElementById('personnel-grid-wrapper').style.display = 'grid';
        renderPersonnel();
      });
    }

    if (btnPagPrev) {
      btnPagPrev.addEventListener('click', () => {
        if (personalPage > 1) {
          personalPage--;
          renderPersonnel();
        }
      });
    }

    if (btnPagNext) {
      btnPagNext.addEventListener('click', () => {
        personalPage++;
        renderPersonnel();
      });
    }
  }

  function getFilteredPersonnel() {
    let list = [...state.personal];

    // Filter multi-sector
    if (personalFilterType === 'multisector') {
      list = list.filter(p => p.is_multi_sector);
    }

    // Filter by sector
    if (personalFilterSector !== 'all') {
      list = list.filter(p => matchesSectorFilter(p, personalFilterSector));
      if (personalFilterSector === 'informatica') {
        list.sort((a, b) => {
          const aIsDario = (a.apellidos || '').toUpperCase().includes('ORQUERA') || (a.nombres || '').toUpperCase().includes('DARIO') || (a.nombres || '').toUpperCase().includes('DARÍO');
          const bIsDario = (b.apellidos || '').toUpperCase().includes('ORQUERA') || (b.nombres || '').toUpperCase().includes('DARIO') || (b.nombres || '').toUpperCase().includes('DARÍO');
          if (aIsDario && !bIsDario) return -1;
          if (!aIsDario && bIsDario) return 1;
          return 0;
        });
      }
    }

    // Filter by GDE status
    if (personalFilterGde !== 'all') {
      list = list.filter(p => {
        const cap = (p.capacitacion_gde || '').toUpperCase();
        const mod = (p.modalidad_capacitacion || '').toLowerCase();
        if (personalFilterGde === 'si-completo') {
          return mod.includes('virtual + presencial') || (cap === 'SI' && mod.includes('presencial'));
        }
        if (personalFilterGde === 'si-virtual') {
          return mod.includes('aula virtual') && !mod.includes('presencial');
        }
        if (personalFilterGde === 'si-presencial') {
          return mod.includes('presencial') && !mod.includes('virtual');
        }
        if (personalFilterGde === 'no') {
          return cap === 'NO' || (!p.modalidad_capacitacion && cap !== 'SI');
        }
        return true;
      });
    }

    // Filter by profession
    if (personalFilterProf !== 'all') {
      list = list.filter(p => {
        const prof = (p.profesion || '').toLowerCase();
        const funcs = (p.sectores || []).map(s => (s.funcion || '').toLowerCase()).join(' ');
        if (personalFilterProf === 'tecnico') return prof.includes('tecnic') || prof.includes('sistemas') || prof.includes('informat') || funcs.includes('tecnic') || funcs.includes('sistemas') || funcs.includes('informat');
        if (personalFilterProf === 'abogado') return prof.includes('abogad') || funcs.includes('abogad');
        if (personalFilterProf === 'trabajo-social') return prof.includes('social') || funcs.includes('social');
        if (personalFilterProf === 'psicologia') return prof.includes('psicolog') || funcs.includes('psicolog');
        if (personalFilterProf === 'administrativo') return prof.includes('admin') || funcs.includes('admin');
        if (personalFilterProf === 'operador') return prof.includes('operador') || funcs.includes('operador');
        if (personalFilterProf === 'responsable') return funcs.includes('responsable') || funcs.includes('coordinador') || funcs.includes('director');
        return true;
      });
    }

    // Search query
    if (personalSearchQuery) {
      list = list.filter(p => {
        const full = `${p.apellidos} ${p.nombres} ${p.cuil} ${p.usuario_gde} ${p.profesion} ${p.correo} ${p.telefono}`.toLowerCase();
        const sectorsText = (p.sectores || []).map(s => `${s.sector_nombre} ${s.funcion}`).join(' ').toLowerCase();
        return full.includes(personalSearchQuery) || sectorsText.includes(personalSearchQuery);
      });
    }

    return list;
  }

  function renderPersonnel() {
    const filtered = getFilteredPersonnel();
    const total = filtered.length;

    // Update count indicator
    const lblCount = document.getElementById('lbl-result-count');
    if (lblCount) lblCount.textContent = `Mostrando ${total} de ${state.personal.length} agentes`;

    // Pagination calculations
    const totalPages = Math.ceil(total / personalPerPage) || 1;
    if (personalPage > totalPages) personalPage = totalPages;
    if (personalPage < 1) personalPage = 1;

    const startIdx = (personalPage - 1) * personalPerPage;
    const endIdx = Math.min(startIdx + personalPerPage, total);
    const paginated = filtered.slice(startIdx, endIdx);

    // Update pagination labels
    const pagStart = document.getElementById('pag-start');
    const pagEnd = document.getElementById('pag-end');
    const pagTotal = document.getElementById('pag-total');
    const pagCurrent = document.getElementById('lbl-page-current');
    const btnPrev = document.getElementById('btn-pag-prev');
    const btnNext = document.getElementById('btn-pag-next');

    if (pagStart) pagStart.textContent = total > 0 ? startIdx + 1 : 0;
    if (pagEnd) pagEnd.textContent = endIdx;
    if (pagTotal) pagTotal.textContent = total;
    if (pagCurrent) pagCurrent.textContent = `Pág ${personalPage} de ${totalPages}`;
    if (btnPrev) btnPrev.disabled = personalPage <= 1;
    if (btnNext) btnNext.disabled = personalPage >= totalPages;

    if (personalViewMode === 'table') {
      renderPersonnelTable(paginated);
    } else {
      renderPersonnelCards(paginated);
    }
  }

  function renderPersonnelTable(list) {
    const tbody = document.getElementById('personnel-tbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">No se encontraron agentes coincidentes con los filtros aplicados.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(person => {
      const initials = getInitials(person.apellidos + ' ' + person.nombres);
      
      // Render dynamic badges for all sectors assigned
      const sectorsHtml = (person.sectores || []).map(s => {
        let condClass = 'titular';
        const cond = (s.condicion || '').toLowerCase();
        if (cond.includes('itinerante')) condClass = 'itinerante';
        else if (cond.includes('responsable') || cond.includes('jerarquico')) condClass = 'responsable';
        else if (cond.includes('tecnic')) condClass = 'tecnico';

        return `
          <div class="assigned-sector-pill ${condClass}">
            <span class="condition-badge">${escapeHtml(s.condicion || 'Titular')}</span>
            <span><strong>${escapeHtml(s.sector_nombre)}</strong></span>
            <span style="opacity: 0.8; font-weight: normal;">• ${escapeHtml(s.funcion || 'Agente')}</span>
          </div>
        `;
      }).join('');

      // GDE Badge
      let gdeBadge = '';
      const cap = (person.capacitacion_gde || '').toUpperCase();
      const mod = (person.modalidad_capacitacion || '');
      if (mod.toLowerCase().includes('virtual + presencial') || (cap === 'SI' && mod.toLowerCase().includes('presencial'))) {
        gdeBadge = `<span class="badge-gde si">✔ Capacitado GDE</span>`;
      } else if (mod.toLowerCase().includes('aula virtual')) {
        gdeBadge = `<span class="badge-gde virtual-pending">⏳ Virtual (Pend. Presencial)</span>`;
      } else {
        gdeBadge = `<span class="badge-gde no">✖ Sin Capacitación</span>`;
      }

      return `
        <tr>
          <td>
            <div class="person-cell" style="cursor: pointer;" onclick="window.SNAF_APP.openViewPersonModal('${person.id}')" title="Clic para ver ficha completa">
              <div class="person-avatar">${initials}</div>
              <div>
                <div class="person-name" style="color: var(--primary-color);">
                  ${escapeHtml(person.apellidos)}, ${escapeHtml(person.nombres)}
                  ${person.is_multi_sector ? `<span title="Desempeña funciones en más de un sector" style="color: #f59e0b; cursor: help;">⭐</span>` : ''}
                </div>
                <div class="person-sub">${escapeHtml(person.sit_revista || 'Planta / Contrato')}</div>
              </div>
            </div>
          </td>
          <td>
            <div><strong>${escapeHtml(person.cuil || 'S/D')}</strong></div>
            <div style="font-size: 11.5px; color: #64748b;">${escapeHtml(person.correo || '-')}</div>
            ${person.telefono ? `<div style="font-size: 11px; color: #0284c7;">📞 ${escapeHtml(person.telefono)}</div>` : ''}
          </td>
          <td>
            <div>${escapeHtml(person.profesion || 'Administrativo')}</div>
            ${person.matricula ? `<div style="font-size: 11px; color: #64748b;">${escapeHtml(person.matricula)}</div>` : ''}
          </td>
          <td>
            <div class="sector-pills-list">
              ${sectorsHtml}
            </div>
          </td>
          <td>
            <div>${gdeBadge}</div>
            ${person.usuario_gde ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px;">Usuario: <strong>${escapeHtml(person.usuario_gde)}</strong></div>` : ''}
          </td>
          <td style="text-align: right;">
            <div class="action-buttons" style="justify-content: flex-end;">
              <button class="icon-action-btn" title="Ver ficha de legajo completa" onclick="window.SNAF_APP.openViewPersonModal('${person.id}')" style="color: #0284c7;">
                <i class="ph ph-eye" style="font-size: 15px;"></i>
              </button>
              <button class="icon-action-btn edit" title="Editar datos y sectores" onclick="window.SNAF_APP.openPersonModal('${person.id}')">
                <i class="ph ph-pencil-simple" style="font-size: 15px;"></i>
              </button>
              <button class="icon-action-btn delete" title="Eliminar agente" onclick="window.SNAF_APP.deletePerson('${person.id}')">
                <i class="ph ph-trash" style="font-size: 15px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPersonnelCards(list) {
    const grid = document.getElementById('personnel-grid-wrapper');
    if (!grid) return;

    if (list.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #64748b; background: white; border-radius: 12px;">No se encontraron agentes coincidentes.</div>`;
      return;
    }

    grid.innerHTML = list.map(person => {
      const initials = getInitials(person.apellidos + ' ' + person.nombres);

      const sectorsHtml = (person.sectores || []).map(s => {
        let condClass = 'titular';
        const cond = (s.condicion || '').toLowerCase();
        if (cond.includes('itinerante')) condClass = 'itinerante';
        else if (cond.includes('responsable') || cond.includes('jerarquico')) condClass = 'responsable';
        else if (cond.includes('tecnic')) condClass = 'tecnico';

        return `
        <div class="assigned-sector-pill ${condClass}" style="width: 100%; margin-bottom: 4px;">
          <span class="condition-badge">${escapeHtml(s.condicion || 'Titular')}</span>
          <span><strong>${escapeHtml(s.sector_nombre)}</strong></span>
          <span style="opacity: 0.8;">• ${escapeHtml(s.funcion || 'Agente')}</span>
        </div>
      `;
      }).join('');

      return `
        <div class="person-card">
          <div>
            <div class="person-card-top" style="cursor: pointer;" onclick="window.SNAF_APP.openViewPersonModal('${person.id}')" title="Clic para ver ficha completa">
              <div class="person-avatar" style="width: 44px; height: 44px; font-size: 15px;">${initials}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; font-size: 14.5px; color: var(--slate-900); display: flex; align-items: center; gap: 6px;">
                  ${escapeHtml(person.apellidos)}, ${escapeHtml(person.nombres)}
                  ${person.is_multi_sector ? `<span title="Multi-sector" style="color: #f59e0b;">⭐</span>` : ''}
                </div>
                <div style="font-size: 12px; color: #0284c7; font-weight: 600;">${escapeHtml(person.profesion || 'Administrativo')}</div>
                <div style="font-size: 11px; color: #64748b;">CUIL: ${escapeHtml(person.cuil || 'S/D')}</div>
              </div>
            </div>

            <div class="person-card-details">
              <div><strong>Correo:</strong> ${escapeHtml(person.correo || '-')}</div>
              ${person.telefono ? `<div><strong>Teléfono:</strong> ${escapeHtml(person.telefono)}</div>` : ''}
              ${person.usuario_gde ? `<div><strong>Usuario GDE:</strong> ${escapeHtml(person.usuario_gde)}</div>` : ''}
              <div><strong>Modalidad GDE:</strong> ${escapeHtml(person.modalidad_capacitacion || 'Sin registro')}</div>
            </div>

            <div style="margin-top: 10px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--slate-500); margin-bottom: 6px;">
                Sectores Asignados (${(person.sectores || []).length})
              </div>
              <div class="sector-pills-list" style="max-width: 100%;">
                ${sectorsHtml}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--slate-100);">
            <button class="btn btn-outline btn-sm" onclick="window.SNAF_APP.openViewPersonModal('${person.id}')" title="Ver ficha completa">
              👁️ Ver Ficha
            </button>
            <button class="btn btn-outline btn-sm" onclick="window.SNAF_APP.openPersonModal('${person.id}')" title="Editar datos">
              ✏️ Editar
            </button>
            <button class="btn btn-danger btn-sm" onclick="window.SNAF_APP.deletePerson('${person.id}')" title="Eliminar">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ========================================================================
  // TAB 4: ESTRUCTURA DE SECTORES
  // ========================================================================
  function setupSectorControls() {
    const searchInput = document.getElementById('sectors-search-input');
    const filterType = document.getElementById('filter-sector-type');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        sectorSearchQuery = e.target.value.trim().toLowerCase();
        renderSectors();
      });
    }

    if (filterType) {
      filterType.addEventListener('change', (e) => {
        sectorTypeFilter = e.target.value;
        renderSectors();
      });
    }
  }

  function renderSectors() {
    const tbody = document.getElementById('sectors-tbody');
    if (!tbody) return;

    let list = [...state.sectores];

    if (sectorTypeFilter !== 'all') {
      list = list.filter(s => (s.tipo || '').toLowerCase().includes(sectorTypeFilter.toLowerCase()));
    }

    if (sectorSearchQuery) {
      list = list.filter(s => {
        const full = `${s.nombre} ${s.responsable} ${s.tipo} ${s.cargo_responsable}`.toLowerCase();
        return full.includes(sectorSearchQuery);
      });
    }

    tbody.innerHTML = list.map(sector => {
      const staff = getPersonnelInSector(sector.id);
      const multiCount = staff.filter(p => p.is_multi_sector).length;
      const parentSector = sector.parent_id ? getSectorById(sector.parent_id) : null;

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--slate-900); display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${sector.color || '#3b82f6'};"></span>
              ${escapeHtml(sector.nombre)}
            </div>
            ${sector.direccion ? `<div style="font-size: 11px; color: #64748b; margin-left: 18px;">📍 ${escapeHtml(sector.direccion)}</div>` : ''}
          </td>
          <td>
            <span class="sector-type-badge">${escapeHtml(sector.tipo || 'Sector')}</span>
          </td>
          <td>
            ${parentSector ? `<span style="font-weight: 600; color: #0284c7;">${escapeHtml(parentSector.nombre)}</span>` : '<span style="color: #94a3b8;">Máximo Nivel</span>'}
          </td>
          <td>
            <div><strong>${escapeHtml((sector.responsable && normText(sector.responsable) !== 'a designar') ? sector.responsable : '')}</strong></div>
            <div style="font-size: 11px; color: #64748b;">${escapeHtml(sector.cargo_responsable || '')}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-size: 14px;">${staff.length}</span>
              ${multiCount > 0 ? `<span class="multi-sector-counter">⭐ ${multiCount} multi</span>` : ''}
            </div>
          </td>
          <td style="text-align: right;">
            <div class="action-buttons" style="justify-content: flex-end;">
              <button class="btn btn-outline btn-sm" onclick="window.SNAF_APP.openSectorDrawer('${sector.id}')" title="Ver dotación">
                👁️ Dotación
              </button>
              <button class="btn btn-outline btn-sm" onclick="window.SNAF_APP.openSectorModal('${sector.id}')" title="Editar sector">
                ✏️ Editar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ========================================================================
  // TAB 5: TABLERO & ESTADÍSTICAS
  // ========================================================================
  function renderDashboard() {
    updateHeaderKPIs();

    // 1. Reparticiones breakdown
    const distRepContainer = document.getElementById('dash-dist-reparticiones');
    if (distRepContainer) {
      const topSectors = [
        { id: 'dir-ninez', name: 'Dirección de Niñez, Adol. y Familia (Red OPDs / Línea 102)', color: '#0284c7' },
        { id: 'dir-dispositivos', name: 'Dirección Prov. de Dispositivos de Cuidados (CDIs / Penal)', color: '#7c3aed' },
        { id: 'coord-adm', name: 'Coordinación de Gestión Administrativa (Compras, Tesorería, Mantenimiento)', color: '#059669' },
        { id: 'sec-snaf', name: 'Conducción Central SNAF (Secretaría, RRHH, Informática, Prensa)', color: '#4f46e5' }
      ];

      const totalAgents = state.personal.length || 1;

      distRepContainer.innerHTML = topSectors.map(item => {
        // Find all subordinate sector IDs
        const subSectorIds = getSubSectorIds(item.id);
        const count = state.personal.filter(p => 
          p.sectores && p.sectores.some(s => subSectorIds.includes(s.sector_id))
        ).length;

        const pct = Math.round((count / totalAgents) * 100);

        return `
          <div class="progress-item">
            <div class="progress-item-header">
              <span>${escapeHtml(item.name)}</span>
              <span><strong>${count}</strong> agentes (${pct}%)</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%; background: ${item.color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 2. GDE breakdown
    const distGdeContainer = document.getElementById('dash-dist-gde');
    if (distGdeContainer) {
      const total = state.personal.length || 1;
      
      const vYp = state.personal.filter(p => (p.modalidad_capacitacion || '').toLowerCase().includes('virtual + presencial')).length;
      const soloV = state.personal.filter(p => (p.modalidad_capacitacion || '').toLowerCase().includes('aula virtual') && !(p.modalidad_capacitacion || '').toLowerCase().includes('presencial')).length;
      const soloP = state.personal.filter(p => (p.modalidad_capacitacion || '').toLowerCase().includes('presencial') && !(p.modalidad_capacitacion || '').toLowerCase().includes('virtual')).length;
      const sinCap = total - (vYp + soloV + soloP);

      const items = [
        { label: 'Aula Virtual + Presencial (Completo)', count: vYp, color: '#10b981' },
        { label: 'Solo Presencial', count: soloP, color: '#0284c7' },
        { label: 'Aula Virtual Aprobada (Pendiente Presencial)', count: soloV, color: '#f59e0b' },
        { label: 'Sin Capacitación GDE / Pendiente', count: sinCap, color: '#94a3b8' }
      ];

      distGdeContainer.innerHTML = items.map(it => {
        const pct = Math.round((it.count / total) * 100);
        return `
          <div class="progress-item">
            <div class="progress-item-header">
              <span>${it.label}</span>
              <span><strong>${it.count}</strong> (${pct}%)</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%; background: ${it.color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 3. Multi-sector staff list
    const msTbody = document.getElementById('dash-multisector-tbody');
    if (msTbody) {
      const multiStaff = state.personal.filter(p => p.is_multi_sector);
      if (multiStaff.length === 0) {
        msTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">No hay agentes con funciones multi-sector.</td></tr>`;
      } else {
        msTbody.innerHTML = multiStaff.map(p => {
          const sectorsHtml = (p.sectores || []).map(s => `
            <div class="assigned-sector-pill titular" style="margin-bottom: 3px;">
              <span class="condition-badge">${escapeHtml(s.condicion || 'Titular')}</span>
              <strong>${escapeHtml(s.sector_nombre)}</strong>: ${escapeHtml(s.funcion || 'Agente')}
            </div>
          `).join('');

          return `
            <tr>
              <td>
                <div style="cursor: pointer; color: var(--primary-color);" onclick="window.SNAF_APP.openViewPersonModal('${p.id}')" title="Clic para ver ficha completa">
                  <strong>${escapeHtml(p.apellidos)}, ${escapeHtml(p.nombres)}</strong>
                </div>
              </td>
              <td>${escapeHtml(p.cuil || 'S/D')}</td>
              <td>${escapeHtml(p.profesion || 'Administrativo')}</td>
              <td>
                <div class="sector-pills-list">
                  ${sectorsHtml}
                </div>
              </td>
              <td>
                <div style="display: flex; gap: 6px;">
                  <button class="btn btn-outline btn-sm" onclick="window.SNAF_APP.openViewPersonModal('${p.id}')" title="Ver ficha">
                    👁️ Ver
                  </button>
                  <button class="btn btn-outline btn-sm" onclick="window.SNAF_APP.openPersonModal('${p.id}')" title="Editar">
                    ✏️ Editar
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  function getSubSectorIds(parentSectorId) {
    let ids = [parentSectorId];
    const directChildren = state.sectores.filter(s => s.parent_id === parentSectorId);
    directChildren.forEach(c => {
      ids = ids.concat(getSubSectorIds(c.id));
    });
    return ids;
  }

  // ========================================================================
  // MODAL: EDITAR / CREAR PERSONAL & MULTI-SECTOR
  // ========================================================================
  function setupModalsAndDrawer() {
    // Person Edit/Create Modal
    const modalPerson = document.getElementById('modal-personnel');
    const btnClosePerson = document.getElementById('btn-close-modal-person');
    const btnCancelPerson = document.getElementById('btn-cancel-modal-person');
    const btnSavePerson = document.getElementById('btn-save-person');
    const btnAddSectorRow = document.getElementById('btn-add-sector-row');

    if (btnClosePerson) btnClosePerson.addEventListener('click', closePersonModal);
    if (btnCancelPerson) btnCancelPerson.addEventListener('click', closePersonModal);
    if (btnSavePerson) btnSavePerson.addEventListener('click', savePersonModal);
    if (btnAddSectorRow) btnAddSectorRow.addEventListener('click', () => addSectorRowToModal());

    // Close on outside click (click on backdrop overlay)
    if (modalPerson) {
      modalPerson.addEventListener('click', (e) => {
        if (e.target === modalPerson) closePersonModal();
      });
    }

    // View Person Modal (Read-Only)
    const modalViewPerson = document.getElementById('modal-view-person');
    const btnCloseViewPerson = document.getElementById('btn-close-modal-view-person');
    const btnCloseViewPersonFooter = document.getElementById('btn-close-modal-view-person-footer');
    const btnEditFromView = document.getElementById('btn-edit-from-view-modal');

    if (btnCloseViewPerson) btnCloseViewPerson.addEventListener('click', closeViewPersonModal);
    if (btnCloseViewPersonFooter) btnCloseViewPersonFooter.addEventListener('click', closeViewPersonModal);
    if (btnEditFromView) {
      btnEditFromView.addEventListener('click', () => {
        const targetId = activeViewingPersonId;
        closeViewPersonModal();
        if (targetId) openPersonModal(targetId);
      });
    }

    if (modalViewPerson) {
      modalViewPerson.addEventListener('click', (e) => {
        if (e.target === modalViewPerson) closeViewPersonModal();
      });
    }

    // Sector Drawer
    const drawer = document.getElementById('drawer-sector');
    const btnCloseDrawer = document.getElementById('btn-close-drawer-sector');
    const btnAssignStaff = document.getElementById('btn-assign-person-to-current-sector');

    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeSectorDrawer);
    if (btnAssignStaff) {
      btnAssignStaff.addEventListener('click', () => {
        openPersonModal(null, activeDrawerSectorId);
      });
    }

    // Close drawer when clicking outside panel on dark overlay
    if (drawer) {
      drawer.addEventListener('click', (e) => {
        if (e.target === drawer) closeSectorDrawer();
      });
    }

    // Sector Modal
    const modalSector = document.getElementById('modal-sector');
    const btnCloseSector = document.getElementById('btn-close-modal-sector');
    const btnCancelSector = document.getElementById('btn-cancel-modal-sector');
    const btnSaveSector = document.getElementById('btn-save-sector');

    if (btnCloseSector) btnCloseSector.addEventListener('click', closeSectorModal);
    if (btnCancelSector) btnCancelSector.addEventListener('click', closeSectorModal);
    if (btnSaveSector) btnSaveSector.addEventListener('click', saveSectorModal);

    if (modalSector) {
      modalSector.addEventListener('click', (e) => {
        if (e.target === modalSector) closeSectorModal();
      });
    }

    setupSecRespCombobox();

    // Global Escape key listener to close topmost active modal or drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const viewM = document.getElementById('modal-view-person');
        const editM = document.getElementById('modal-personnel');
        const secM = document.getElementById('modal-sector');
        const drw = document.getElementById('drawer-sector');

        if (viewM && viewM.classList.contains('active')) {
          closeViewPersonModal();
        } else if (editM && editM.classList.contains('active')) {
          closePersonModal();
        } else if (secM && secM.classList.contains('active')) {
          closeSectorModal();
        } else if (drw && drw.classList.contains('active')) {
          closeSectorDrawer();
        }
      }
    });
  }

  function openPersonModal(personId = null, preselectedSectorId = null) {
    const modal = document.getElementById('modal-personnel');
    const titleEl = document.getElementById('modal-person-title');
    const dynamicList = document.getElementById('dynamic-sectors-list');
    if (!modal) return;

    dynamicList.innerHTML = '';

    if (personId) {
      const person = state.personal.find(p => p.id === personId);
      if (!person) return;

      titleEl.innerHTML = `✏️ Editar Personal: <strong>${escapeHtml(person.apellidos)}, ${escapeHtml(person.nombres)}</strong>`;
      document.getElementById('p-id').value = person.id;
      document.getElementById('p-apellidos').value = person.apellidos || '';
      document.getElementById('p-nombres').value = person.nombres || '';
      document.getElementById('p-cuil').value = person.cuil || '';
      document.getElementById('p-profesion').value = person.profesion || '';
      document.getElementById('p-matricula').value = person.matricula || '';
      document.getElementById('p-sit-revista').value = person.sit_revista || 'Planta Permanente';
      document.getElementById('p-correo').value = person.correo || '';
      document.getElementById('p-telefono').value = person.telefono || '';
      document.getElementById('p-horario').value = person.horario || 'Lunes a Viernes 7:00 a 13:00';

      document.getElementById('p-gde-user').value = person.usuario_gde || '';
      document.getElementById('p-caratulador').checked = !!person.caratulador;
      document.getElementById('p-asignador').checked = !!person.asignador;
      document.getElementById('p-gde-cap').value = person.capacitacion_gde || 'NO';
      document.getElementById('p-gde-mod').value = person.modalidad_capacitacion || '';
      document.getElementById('p-gde-calif').value = person.calificaciones_virtual || '';
      document.getElementById('p-gde-asist').value = person.asistencia_presencial || '';
      document.getElementById('p-obs').value = person.observaciones_generales || '';

      // Populate existing sectors
      if (person.sectores && person.sectores.length > 0) {
        person.sectores.forEach(s => addSectorRowToModal(s));
      } else {
        addSectorRowToModal();
      }
    } else {
      // New Person
      titleEl.innerHTML = `➕ Registrar Nuevo Personal`;
      document.getElementById('p-id').value = '';
      document.getElementById('p-apellidos').value = '';
      document.getElementById('p-nombres').value = '';
      document.getElementById('p-cuil').value = '';
      document.getElementById('p-profesion').value = '';
      document.getElementById('p-matricula').value = '';
      document.getElementById('p-sit-revista').value = 'Planta Permanente';
      document.getElementById('p-correo').value = '';
      document.getElementById('p-telefono').value = '';
      document.getElementById('p-horario').value = 'Lunes a Viernes 7:00 a 13:00';

      document.getElementById('p-gde-user').value = '';
      document.getElementById('p-caratulador').checked = false;
      document.getElementById('p-asignador').checked = false;
      document.getElementById('p-gde-cap').value = 'NO';
      document.getElementById('p-gde-mod').value = '';
      document.getElementById('p-gde-calif').value = '';
      document.getElementById('p-gde-asist').value = '';
      document.getElementById('p-obs').value = '';

      if (preselectedSectorId) {
        const sec = getSectorById(preselectedSectorId);
        addSectorRowToModal({ sector_id: preselectedSectorId, sector_nombre: sec?.nombre || '' });
      } else {
        addSectorRowToModal();
      }
    }

    modal.classList.add('active');
  }

  function closePersonModal() {
    const modal = document.getElementById('modal-personnel');
    if (modal) modal.classList.remove('active');
  }

  // ========================================================================
  // MODAL: VER FICHA / DATOS DEL PERSONAL (LECTURA)
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

    // Helper to populate view fields
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
      if (person.caratulador) perms.push('📁 Caratulador');
      if (person.asignador) perms.push('📤 Asignador');
      permisosEl.textContent = perms.length > 0 ? perms.join(' · ') : 'Ninguno asignado';
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

  function addSectorRowToModal(sectorData = null) {
    const list = document.getElementById('dynamic-sectors-list');
    if (!list) return;

    const rowIdx = list.children.length + 1;
    const rowEl = document.createElement('div');
    rowEl.className = 'sector-row-item';

    // Sector options HTML
    const sectorOptions = state.sectores.map(s => {
      const selected = sectorData && sectorData.sector_id === s.id ? 'selected' : '';
      return `<option value="${s.id}" ${selected}>${escapeHtml(s.nombre)} (${s.tipo || 'Sector'})</option>`;
    }).join('');

    rowEl.innerHTML = `
      <div class="sector-row-top">
        <span class="sector-row-badge">Sector Asignado #${rowIdx}</span>
        <button type="button" class="remove-sector-btn" title="Quitar este sector">
          🗑️ Quitar
        </button>
      </div>

      <div class="form-row">
        <div class="form-group" style="grid-column: span 2;">
          <label>Sector / Dependencia *</label>
          <select class="form-control field-sector-id" required>
            ${sectorOptions}
          </select>
        </div>
      </div>

      <div class="form-row" style="margin-top: 8px;">
        <div class="form-group">
          <label>Función / Rol en este Sector</label>
          <input type="text" class="form-control field-sector-func" value="${escapeHtml(sectorData?.funcion || 'ADMINISTRATIVO')}" placeholder="Ej: Abogado Titular, Lic. en Trabajo Social...">
        </div>
        <div class="form-group">
          <label>Condición en este Sector</label>
          <select class="form-control field-sector-cond">
            <option value="Titular" ${(sectorData?.condicion || '') === 'Titular' ? 'selected' : ''}>Titular</option>
            <option value="Personal Técnico" ${(sectorData?.condicion || '').toLowerCase().includes('tecnic') ? 'selected' : ''}>Personal Técnico</option>
            <option value="Itinerante (BIS)" ${(sectorData?.condicion || '').includes('Itinerante') ? 'selected' : ''}>Itinerante (BIS)</option>
            <option value="Base Compartida" ${(sectorData?.condicion || '').includes('Compartida') ? 'selected' : ''}>Base Compartida</option>
            <option value="Responsable / Jerárquico" ${(sectorData?.condicion || '').includes('Responsable') || (sectorData?.condicion || '').includes('Jerarquico') ? 'selected' : ''}>Responsable / Jerárquico</option>
            <option value="Adscripto / Comisión" ${(sectorData?.condicion || '').includes('Adscripto') ? 'selected' : ''}>Adscripto / Comisión</option>
            <option value="Municipal" ${(sectorData?.condicion || '').includes('Municipal') ? 'selected' : ''}>Municipal</option>
          </select>
        </div>
      </div>

      <div class="form-row" style="margin-top: 8px;">
        <div class="form-group">
          <label>Superior Jerárquico Inmediato en este Sector</label>
          <input type="text" class="form-control field-sector-sup" value="${escapeHtml(sectorData?.superior_inmediato || '')}" placeholder="Apellido y Nombre">
        </div>
        <div class="form-group">
          <label>Observaciones de este Sector</label>
          <input type="text" class="form-control field-sector-obs" value="${escapeHtml(sectorData?.observaciones || '')}" placeholder="Notas sobre itinerancia o tareas...">
        </div>
      </div>
    `;

    // Remove row event
    rowEl.querySelector('.remove-sector-btn').addEventListener('click', () => {
      if (list.children.length <= 1) {
        alert('El agente debe tener al menos un sector asignado.');
        return;
      }
      rowEl.remove();
      // Renumber badges
      Array.from(list.children).forEach((child, i) => {
        const badge = child.querySelector('.sector-row-badge');
        if (badge) badge.textContent = `Sector Asignado #${i + 1}`;
      });
    });

    list.appendChild(rowEl);
  }

  function savePersonModal() {
    const id = document.getElementById('p-id').value;
    const apellidos = document.getElementById('p-apellidos').value.trim();
    const nombres = document.getElementById('p-nombres').value.trim();

    if (!apellidos || !nombres) {
      alert('Por favor complete los campos obligatorios de Apellidos y Nombres.');
      return;
    }

    // Collect sector assignments from dynamic rows
    const list = document.getElementById('dynamic-sectors-list');
    const sectorRows = list.querySelectorAll('.sector-row-item');
    if (sectorRows.length === 0) {
      alert('Debe asignar al menos un sector a este personal.');
      return;
    }

    const assignedSectores = [];
    sectorRows.forEach(row => {
      const secId = row.querySelector('.field-sector-id').value;
      const secObj = getSectorById(secId);
      const func = row.querySelector('.field-sector-func').value.trim() || 'ADMINISTRATIVO';
      const cond = row.querySelector('.field-sector-cond').value;
      const sup = row.querySelector('.field-sector-sup').value.trim();
      const obs = row.querySelector('.field-sector-obs').value.trim();

      assignedSectores.push({
        sector_id: secId,
        sector_nombre: secObj ? secObj.nombre : secId,
        reparticion: secObj ? (secObj.tipo || 'SNAF') : 'SNAF',
        funcion: func,
        condicion: cond,
        superior_inmediato: sup,
        observaciones: obs
      });
    });

    const isMulti = assignedSectores.length > 1;

    const personData = {
      id: id || `ID_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      cuil: document.getElementById('p-cuil').value.trim(),
      apellidos: apellidos.toUpperCase(),
      nombres: nombres.toUpperCase(),
      profesion: document.getElementById('p-profesion').value.trim(),
      matricula: document.getElementById('p-matricula').value.trim(),
      sit_revista: document.getElementById('p-sit-revista').value,
      correo: document.getElementById('p-correo').value.trim(),
      telefono: document.getElementById('p-telefono').value.trim(),
      horario: document.getElementById('p-horario').value.trim(),
      usuario_gde: document.getElementById('p-gde-user').value.trim(),
      caratulador: document.getElementById('p-caratulador').checked,
      asignador: document.getElementById('p-asignador').checked,
      capacitacion_gde: document.getElementById('p-gde-cap').value,
      modalidad_capacitacion: document.getElementById('p-gde-mod').value.trim(),
      calificaciones_virtual: document.getElementById('p-gde-calif').value.trim(),
      asistencia_presencial: document.getElementById('p-gde-asist').value.trim(),
      observaciones_generales: document.getElementById('p-obs').value.trim(),
      is_multi_sector: isMulti,
      sectores: assignedSectores
    };

    if (id) {
      // Update
      const idx = state.personal.findIndex(p => p.id === id);
      if (idx !== -1) {
        state.personal[idx] = personData;
        showToast(`Datos de ${personData.apellidos}, ${personData.nombres} actualizados.`, 'success');
      }
    } else {
      // Create new
      state.personal.push(personData);
      showToast(`Personal ${personData.apellidos}, ${personData.nombres} registrado correctamente.`, 'success');
    }

    saveState();
    closePersonModal();
    renderCurrentTab();
    if (activeDrawerSectorId) {
      openSectorDrawer(activeDrawerSectorId);
    }
    if (activeViewingPersonId && activeViewingPersonId === personData.id) {
      openViewPersonModal(personData.id);
    }
  }

  function deletePerson(personId) {
    const person = state.personal.find(p => p.id === personId);
    if (!person) return;

    if (confirm(`¿Confirma eliminar a "${person.apellidos}, ${person.nombres}" de la nómina?`)) {
      state.personal = state.personal.filter(p => p.id !== personId);
      saveState();
      renderCurrentTab();
      showToast('Personal eliminado correctamente.', 'info');
    }
  }

  // ========================================================================
  // DRAWER: FICHA DEL SECTOR (SLIDE-OVER)
  // ========================================================================
  function openSectorDrawer(sectorId) {
    activeDrawerSectorId = sectorId;
    const sector = getSectorById(sectorId);
    const drawer = document.getElementById('drawer-sector');
    if (!sector || !drawer) return;

    const cleanDrawerResp = (sector.responsable && normText(sector.responsable) !== 'a designar') ? sector.responsable.trim() : '';
    document.getElementById('drawer-sector-type').textContent = sector.tipo || 'Sector';
    document.getElementById('drawer-sector-name').textContent = sector.nombre;
    document.getElementById('drawer-authority-name').textContent = cleanDrawerResp;
    document.getElementById('drawer-authority-cargo').textContent = cleanDrawerResp ? (sector.cargo_responsable || 'Responsable') : '';
    document.getElementById('drawer-authority-avatar').textContent = getInitials(cleanDrawerResp || sector.nombre);
    document.getElementById('drawer-sector-desc').textContent = sector.descripcion || '';

    // Extra info for OPD
    const opdExtra = document.getElementById('drawer-opd-extra-info');
    if (sector.num_opd && opdExtra) {
      opdExtra.style.display = 'block';
      opdExtra.innerHTML = `
        ${sector.direccion ? `<div><strong>📍 Sede:</strong> ${escapeHtml(sector.direccion)}</div>` : ''}
        ${sector.horario ? `<div><strong>⏰ Horario:</strong> ${escapeHtml(sector.horario)}</div>` : ''}
        ${sector.telefono_guardia ? `<div><strong>📞 Guardia WIN:</strong> ${escapeHtml(sector.telefono_guardia)}</div>` : ''}
        ${sector.cobertura ? `<div><strong>🗺️ Cobertura:</strong> ${escapeHtml(sector.cobertura)}</div>` : ''}
      `;
    } else if (opdExtra) {
      opdExtra.style.display = 'none';
    }

    // Render personnel in this sector
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
            <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; cursor: pointer;" onclick="window.SNAF_APP.openViewPersonModal('${person.id}')" title="Clic para ver ficha completa">
              <div class="person-avatar" style="width: 36px; height: 36px; font-size: 13px;">${initials}</div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 13.5px; color: var(--slate-900);">
                  ${escapeHtml(person.apellidos)}, ${escapeHtml(person.nombres)}
                  ${person.is_multi_sector ? `<span title="Multi-sector" style="color: #f59e0b; margin-left: 4px;">⭐</span>` : ''}
                </div>
                <div style="font-size: 12px; color: #0284c7; font-weight: 600;">
                  ${escapeHtml(thisRole?.funcion || person.profesion || 'Personal')}
                  ${(thisRole?.condicion && thisRole.condicion !== thisRole.funcion && !(thisRole?.funcion || '').toLowerCase().includes((thisRole.condicion || '').toLowerCase()) && !(thisRole.condicion || '').toLowerCase().includes((thisRole?.funcion || '').toLowerCase())) ? `<span style="font-weight: normal; color: #64748b;">(${escapeHtml(thisRole.condicion)})</span>` : ''}
                </div>
                ${person.correo ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(person.correo)}</div>` : ''}

                ${otherSectors.length > 0 ? `
                  <div style="margin-top: 6px; font-size: 10.5px; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                    ⭐ Cumple funciones también en: ${otherSectors.map(o => escapeHtml(o.sector_nombre)).join(' + ')}
                  </div>
                ` : ''}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <button class="btn btn-outline btn-sm" onclick="window.SNAF_APP.openViewPersonModal('${person.id}')" title="Ver ficha completa" style="padding: 4px 8px; font-size: 12px;">
                👁️ Ver
              </button>
              <button class="btn btn-outline btn-sm" onclick="window.SNAF_APP.openPersonModal('${person.id}')" title="Editar este agente" style="padding: 4px 8px; font-size: 12px;">
                ✏️ Editar
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
  // MODAL: CREAR / EDITAR SECTOR
  // ========================================================================
  function populateSectorDropdowns() {
    const filterSecDropdown = document.getElementById('filter-sector-dropdown');
    if (filterSecDropdown) {
      filterSecDropdown.innerHTML = '<option value="all">Filtrar por Sector (Todos)</option>' +
        state.sectores.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('');
    }

    const parentSelect = document.getElementById('sec-parent');
    if (parentSelect) {
      parentSelect.innerHTML = '<option value="">Sin dependencia superior (Raíz)</option>' +
        state.sectores.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('');
    }
  }

  function setupSecRespCombobox() {
    const input = document.getElementById('sec-responsable');
    const clearBtn = document.getElementById('btn-clear-sec-resp');
    const toggleBtn = document.getElementById('btn-toggle-sec-resp');
    const menu = document.getElementById('sec-resp-dropdown-menu');
    const wrapper = document.getElementById('sec-resp-combobox');
    if (!input || !menu || !wrapper) return;

    input.addEventListener('focus', () => {
      renderSecRespDropdown('');
      menu.style.display = 'block';
    });

    input.addEventListener('click', () => {
      if (menu.style.display === 'none') {
        renderSecRespDropdown('');
        menu.style.display = 'block';
      }
    });

    input.addEventListener('input', () => {
      updateSecRespClearBtn();
      renderSecRespDropdown(input.value);
      menu.style.display = 'block';
    });

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.style.display === 'block') {
          menu.style.display = 'none';
        } else {
          renderSecRespDropdown('');
          menu.style.display = 'block';
          input.focus();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        updateSecRespClearBtn();
        renderSecRespDropdown('');
        input.focus();
      });
    }

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.searchable-dropdown-item');
      if (!item) return;
      const val = item.getAttribute('data-value') || '';
      input.value = val;
      updateSecRespClearBtn();
      menu.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  }

  function updateSecRespClearBtn() {
    const input = document.getElementById('sec-responsable');
    const clearBtn = document.getElementById('btn-clear-sec-resp');
    if (input && clearBtn) {
      clearBtn.style.display = input.value.trim().length > 0 ? 'flex' : 'none';
    }
  }

  function renderSecRespDropdown(query = '') {
    const menu = document.getElementById('sec-resp-dropdown-menu');
    if (!menu) return;

    const currentSecId = document.getElementById('sec-id')?.value || '';
    const q = normText(query);

    let list = [...(state.personal || [])];
    list.sort((a, b) => {
      const aInSec = currentSecId && (a.sectores || []).some(s => s.sector_id === currentSecId);
      const bInSec = currentSecId && (b.sectores || []).some(s => s.sector_id === currentSecId);
      if (aInSec && !bInSec) return -1;
      if (!aInSec && bInSec) return 1;
      const nameA = `${a.apellidos || ''} ${a.nombres || ''}`.toLowerCase();
      const nameB = `${b.apellidos || ''} ${b.nombres || ''}`.toLowerCase();
      return nameA.localeCompare(nameB, 'es');
    });

    if (q) {
      list = list.filter(p => {
        const full = normText(`${p.apellidos || ''} ${p.nombres || ''} ${p.cuil || ''} ${p.profesion || ''}`);
        return full.includes(q);
      });
    }

    let html = `
      <div class="searchable-dropdown-item empty-option" data-value="">
        <span>✖ Sin responsable asignado (dejar vacío)</span>
      </div>
    `;

    if (list.length === 0) {
      html += `
        <div style="padding: 12px 10px; font-size: 12px; color: #64748b; text-align: center;">
          No se encontró personal con "${escapeHtml(query)}". Podés dejar el texto escrito manualmente.
        </div>
      `;
    } else {
      html += list.map(p => {
        const formattedName = formatPersonName(p);
        const inSec = currentSecId && (p.sectores || []).some(s => s.sector_id === currentSecId);
        const secNames = (p.sectores || []).map(s => s.sector_nombre).filter(Boolean).join(' · ');
        const subParts = [];
        if (p.profesion) subParts.push(p.profesion);
        if (p.cuil) subParts.push(`CUIL ${p.cuil}`);
        if (secNames) subParts.push(secNames);

        return `
          <div class="searchable-dropdown-item" data-value="${escapeHtml(formattedName)}">
            <div class="dropdown-person-main">
              <span>${escapeHtml(p.apellidos || '')}, ${escapeHtml(p.nombres || '')}</span>
              ${inSec ? `<span class="dropdown-sector-tag">En este sector</span>` : ''}
            </div>
            <div class="dropdown-person-sub">${escapeHtml(subParts.join(' · ') || 'Personal SNAF')}</div>
          </div>
        `;
      }).join('');
    }

    menu.innerHTML = html;
  }

  function openSectorModal(sectorId = null) {
    const modal = document.getElementById('modal-sector');
    const titleEl = document.getElementById('modal-sector-title');
    const menu = document.getElementById('sec-resp-dropdown-menu');
    if (!modal) return;
    if (menu) menu.style.display = 'none';

    populateSectorDropdowns();

    if (sectorId) {
      const sector = getSectorById(sectorId);
      if (!sector) return;
      titleEl.innerHTML = `✏️ Editar Sector: <strong>${escapeHtml(sector.nombre)}</strong>`;
      document.getElementById('sec-id').value = sector.id;
      document.getElementById('sec-nombre').value = sector.nombre || '';
      document.getElementById('sec-tipo').value = sector.tipo || 'Área Operativa';
      document.getElementById('sec-parent').value = sector.parent_id || '';
      const rawResp = (sector.responsable && normText(sector.responsable) !== 'a designar') ? sector.responsable : '';
      document.getElementById('sec-responsable').value = rawResp;
      document.getElementById('sec-cargo').value = sector.cargo_responsable || '';
      document.getElementById('sec-desc').value = sector.descripcion || '';
    } else {
      titleEl.innerHTML = `➕ Crear Nuevo Sector / Área`;
      document.getElementById('sec-id').value = '';
      document.getElementById('sec-nombre').value = '';
      document.getElementById('sec-tipo').value = 'Área Operativa';
      document.getElementById('sec-parent').value = 'sec-snaf';
      document.getElementById('sec-responsable').value = '';
      document.getElementById('sec-cargo').value = '';
      document.getElementById('sec-desc').value = '';
    }

    updateSecRespClearBtn();
    modal.classList.add('active');
  }

  function closeSectorModal() {
    const modal = document.getElementById('modal-sector');
    const menu = document.getElementById('sec-resp-dropdown-menu');
    if (menu) menu.style.display = 'none';
    if (modal) modal.classList.remove('active');
  }

  function saveSectorModal() {
    const id = document.getElementById('sec-id').value;
    const nombre = document.getElementById('sec-nombre').value.trim();
    if (!nombre) {
      alert('El nombre del sector es obligatorio.');
      return;
    }

    const parentId = document.getElementById('sec-parent').value || null;
    const tipo = document.getElementById('sec-tipo').value;
    const responsable = document.getElementById('sec-responsable').value.trim();
    const cargo = document.getElementById('sec-cargo').value.trim();
    const desc = document.getElementById('sec-desc').value.trim();

    // Determine level from parent (root sec-snaf has nivel 0, so direct children have nivel 1)
    let nivel = 0;
    if (parentId) {
      const parent = getSectorById(parentId);
      if (parent) nivel = getDynamicSectorLevel(parent) + 1;
      else nivel = 1;
    }

    if (id) {
      const idx = state.sectores.findIndex(s => s.id === id);
      if (idx !== -1) {
        state.sectores[idx] = {
          ...state.sectores[idx],
          nombre,
          tipo,
          parent_id: parentId,
          nivel,
          responsable,
          cargo_responsable: cargo,
          descripcion: desc
        };
        showToast(`Sector "${nombre}" actualizado.`, 'success');
      }
    } else {
      const newId = `sec_${Date.now()}`;
      state.sectores.push({
        id: newId,
        nombre,
        tipo,
        parent_id: parentId,
        nivel,
        responsable,
        cargo_responsable: cargo,
        descripcion: desc,
        color: '#0284c7'
      });
      showToast(`Sector "${nombre}" creado exitosamente.`, 'success');
    }

    // Recalculate all sector levels dynamically so any moved subtree updates its level/color
    state.sectores.forEach(s => {
      s.nivel = getDynamicSectorLevel(s);
    });

    saveState();
    closeSectorModal();
    populateSectorDropdowns();
    renderCurrentTab();
  }

  // ========================================================================
  // EXPORT / IMPORT DATA
  // ========================================================================
  function exportJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `organigrama_snaf_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Base de datos exportada en formato JSON.', 'success');
  }

  function exportCSV() {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'APELLIDOS,NOMBRES,CUIL,PROFESION,MATRICULA,SIT_REVISTA,CORREO,TELEFONO,USUARIO_GDE,CAPACITACION_GDE,MODALIDAD,SECTORES_ASIGNADOS,ES_MULTI_SECTOR\n';

    state.personal.forEach(p => {
      const sectorsStr = (p.sectores || []).map(s => `[${s.condicion}] ${s.sector_nombre} (${s.funcion})`).join(' | ');
      const row = [
        `"${p.apellidos || ''}"`,
        `"${p.nombres || ''}"`,
        `"${p.cuil || ''}"`,
        `"${p.profesion || ''}"`,
        `"${p.matricula || ''}"`,
        `"${p.sit_revista || ''}"`,
        `"${p.correo || ''}"`,
        `"${p.telefono || ''}"`,
        `"${p.usuario_gde || ''}"`,
        `"${p.capacitacion_gde || ''}"`,
        `"${p.modalidad_capacitacion || ''}"`,
        `"${sectorsStr}"`,
        `"${p.is_multi_sector ? 'SI' : 'NO'}"`
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina_personal_snaf_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Nómina de personal exportada a CSV con asignaciones de sectores.', 'success');
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.sectores && parsed.personal) {
          state = parsed;
          saveState();
          populateSectorDropdowns();
          renderCurrentTab();
          showToast('Base de datos importada exitosamente.', 'success');
        } else {
          alert('El archivo JSON no tiene la estructura válida de Organigrama SNAF.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // ========================================================================
  // UTILITIES & TOAST
  // ========================================================================
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

  function getInitials(str) {
    if (!str) return 'SN';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✔' : 'ℹ'}</span>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Expose global API for inline buttons
  window.SNAF_APP = {
    openPersonModal,
    openViewPersonModal,
    closeViewPersonModal,
    deletePerson,
    openSectorDrawer,
    openSectorModal,
    switchTab
  };

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
