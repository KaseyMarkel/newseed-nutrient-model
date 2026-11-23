// Choropleth of Guatemala's 22 departments with Plotly (geo, no tile server).
// GeoJSON: geoBoundaries gbOpen GTM ADM1 (simplified), site/data/gtm_adm1.geojson.
// Department names in the GeoJSON already match Azahar's `region` names; the
// explicit map below documents that and guards against future renames.

export const GEO_NAME_TO_REGION = {
  'Alta Verapaz': 'Alta Verapaz', 'Baja Verapaz': 'Baja Verapaz', 'Chimaltenango': 'Chimaltenango',
  'Chiquimula': 'Chiquimula', 'El Progreso': 'El Progreso', 'Escuintla': 'Escuintla', 'Guatemala': 'Guatemala',
  'Huehuetenango': 'Huehuetenango', 'Izabal': 'Izabal', 'Jalapa': 'Jalapa', 'Jutiapa': 'Jutiapa',
  'Petén': 'Petén', 'Peten': 'Petén', 'Quetzaltenango': 'Quetzaltenango',
  'Quiché': 'Quiché', 'Quiche': 'Quiché', 'Retalhuleu': 'Retalhuleu',
  'Sacatepéquez': 'Sacatepéquez', 'Sacatepequez': 'Sacatepéquez', 'San Marcos': 'San Marcos',
  'Santa Rosa': 'Santa Rosa', 'Sololá': 'Sololá', 'Solola': 'Sololá',
  'Suchitepéquez': 'Suchitepéquez', 'Suchitepequez': 'Suchitepéquez',
  'Totonicapán': 'Totonicapán', 'Totonicapan': 'Totonicapán', 'Zacapa': 'Zacapa'
};

export const SCALES = {
  red: [[0, '#fbf1ef'], [0.35, '#e8b4ad'], [0.7, '#c4665b'], [1, '#8e3129']],
  ochre: [[0, '#fbf3e3'], [0.4, '#e6cb93'], [0.75, '#cf9d49'], [1, '#9a6618']],
  green: [[0, '#eef5ee'], [0.5, '#8fbf96'], [1, '#2e7d4f']],
  diverging: [[0, '#2e7d4f'], [0.5, '#f4f1ec'], [1, '#b3261e']]
};

function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2; // > 0 = counter-clockwise in lon/lat
}
function rewind(geom) {
  if (!geom) return;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      const ccw = ringArea(ring) > 0;
      if ((i === 0 && ccw) || (i > 0 && !ccw)) ring.reverse();
    });
  }
}

let geoPromise = null;
export function loadGeo() {
  if (!geoPromise) {
    geoPromise = fetch('data/gtm_adm1.geojson').then(r => r.json()).then(g => {
      // normalise feature ids to Azahar region names and fix ring winding
      // (d3-geo, used by Plotly, needs clockwise exterior rings; geoBoundaries
      // ships counter-clockwise ones, which render as the whole globe minus the shape)
      for (const f of g.features) {
        const n = f.properties.shapeName;
        f.id = GEO_NAME_TO_REGION[n] || n;
        rewind(f.geometry);
      }
      return g;
    });
  }
  return geoPromise;
}

const BASE_LAYOUT = {
  margin: { l: 0, r: 0, t: 0, b: 0 },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { family: 'Segoe UI, system-ui, sans-serif', size: 12, color: '#262321' },
  geo: { fitbounds: 'locations', visible: false, projection: { type: 'mercator' }, bgcolor: 'rgba(0,0,0,0)' },
  dragmode: false
};

// spec = display.js mapSpec(): { regions, z (display units), text (hover, as the live app), legend }.
export async function drawMap(el, spec, opts = {}) {
  const geo = await loadGeo();
  const scale = SCALES[opts.scale || 'red'];
  const trace = {
    type: 'choropleth', geojson: geo, locations: spec.regions, z: spec.z, text: spec.text, hoverinfo: 'text',
    featureidkey: 'id', colorscale: scale, reversescale: !!opts.reverse,
    marker: { line: { color: '#ffffff', width: 1 } },
    colorbar: { title: { text: spec.legend, side: 'right' }, thickness: 14, len: 0.75, outlinewidth: 0, tickfont: { size: 11 }, tickformat: opts.tickformat || '' }
  };
  if (opts.zmin != null) trace.zmin = opts.zmin;
  if (opts.zmax != null) trace.zmax = opts.zmax;
  const layout = { ...BASE_LAYOUT };
  await Plotly.react(el, [trace], layout, { displayModeBar: false, responsive: true, scrollZoom: false, topojsonURL: 'vendor/' });
  if (opts.onClick) {
    el.removeAllListeners && el.removeAllListeners('plotly_click');
    el.on('plotly_click', ev => { const p = ev.points && ev.points[0]; if (p) opts.onClick(p.location); });
  }
}
