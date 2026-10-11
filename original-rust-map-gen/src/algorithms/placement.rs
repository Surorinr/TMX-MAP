use std::collections::HashSet;



use rand::seq::SliceRandom;

use rand::Rng;



use crate::state::{Matrix, WizardState};



const BORDER_MARGIN_RATIO: f64 = 0.08;

const CENTER_FORBIDDEN_RATIO: f64 = 0.06;

const CC_MARGIN_RATIO: f64 = 0.07;

const CC_MIN_DISTANCE_RATIO: f64 = 0.1;

// Bundled TMX blueprints expose 50 player/command-center slots (GIDs 101..150).
// Keep the generator limit aligned with the actual blueprint capacity.
pub(crate) const MAX_COMMAND_CENTERS: usize = 50;

/// First GID of the bundled `50pCommandCenter` tileset.
pub(crate) const CC_FIRST_GID: i32 = 101;

/// 3.3.0 fix: player slot (team, 0-based) -> TMX GID.
///
/// The bundled `50pCommandCenter` tileset (5 columns x 10 rows) does NOT store
/// teams linearly. Its tile properties are laid out in blocks of 10 tiles
/// (two rows):
///   row 0 of a block: team +0, +2, +4, +6, +8
///   row 1 of a block: team +1, +3, +5, +7, +9
/// Rusted Warfare (and editors such as NotTiled) read the `team` property of
/// the tile, not its index, so writing `101 + i` turned player 2 into team 2
/// (= player 3), player 6 into team 1 (= player 2), and so on.
pub(crate) fn cc_gid_for_team(team: usize) -> i32 {
    let block = team / 10;
    let r = team % 10;
    let local = block * 10 + if r % 2 == 0 { r / 2 } else { 5 + r / 2 };
    CC_FIRST_GID + local as i32
}

/// Inverse of [`cc_gid_for_team`]; `None` when the GID is not a command center.
pub(crate) fn cc_team_for_gid(gid: i32) -> Option<usize> {
    if gid < CC_FIRST_GID || gid >= CC_FIRST_GID + MAX_COMMAND_CENTERS as i32 {
        return None;
    }
    let local = (gid - CC_FIRST_GID) as usize;
    let (block, k) = (local / 10, local % 10);
    Some(block * 10 + if k < 5 { k * 2 } else { (k - 5) * 2 + 1 })
}

/// Rewrite every command-center GID of `state.units_matrix` from
/// `state.cc_positions`, in order: position i becomes player i+1 (team i).
pub(crate) fn rebuild_cc_matrix(state: &mut WizardState) {
    let Some(units) = state.units_matrix.as_mut() else { return };
    for v in units.data.iter_mut() {
        if cc_team_for_gid(*v).is_some() {
            *v = 0;
        }
    }
    for (i, &(r, c)) in state.cc_positions.iter().take(MAX_COMMAND_CENTERS).enumerate() {
        if r < units.rows && c < units.cols {
            units.set(r, c, cc_gid_for_team(i));
        }
    }
}



pub(crate) fn add_command_centers(
    randomized_matrix: &Matrix,
    num_centers: i32,
    mirroring: &str,
    height_map_shape: (usize, usize),
    items_matrix: Option<&Matrix>,
    wall_matrix: Option<&Matrix>,
) -> Result<Matrix, String> {
    let requested = (num_centers.max(0) as usize).min(MAX_COMMAND_CENTERS);
    let (rows, cols) = height_map_shape;
    let mut result = Matrix::zeros(rows, cols);
    if requested == 0 || rows == 0 || cols == 0 { return Ok(result); }

    // IMPORTANT: spawn candidates must come from the real map, not the 5x5
    // low-resolution coastline matrix. The old implementation had at most
    // 25 source cells, making 40/50 spawn points impossible on large maps.
    // We scan a bounded grid for performance, then refine every selected point
    // on the real-resolution map.
    let total = rows.saturating_mul(cols);
    let stride = if total > 120_000 {
        (((total as f64) / 12_000.0).sqrt().ceil() as usize).max(1)
    } else { 1 };
    let margin_r = ((rows as f64) * CC_MARGIN_RATIO).round() as usize;
    let margin_c = ((cols as f64) * CC_MARGIN_RATIO).round() as usize;
    let min_r = margin_r.min(rows.saturating_sub(1));
    let max_r = rows.saturating_sub(1).saturating_sub(min_r);
    let min_c = margin_c.min(cols.saturating_sub(1));
    let max_c = cols.saturating_sub(1).saturating_sub(min_c);
    let center_r = (rows.saturating_sub(1)) as f64 / 2.0;
    let center_c = (cols.saturating_sub(1)) as f64 / 2.0;
    let min_distance = ((rows.min(cols) as f64) * CC_MIN_DISTANCE_RATIO).max(2.0);

    let walkable = |r: usize, c: usize| -> bool {
        if r >= rows || c >= cols || r < min_r || r > max_r || c < min_c || c > max_c { return false; }
        if let Some(items) = items_matrix { if has_non_zero_in_radius(items, r, c, 2) { return false; } }
        if let Some(walls) = wall_matrix { if has_equals_one_in_radius(walls, r, c, 1) { return false; } }
        true
    };

    let preferred = |r: usize, c: usize| -> bool {
        if randomized_matrix.rows == 0 || randomized_matrix.cols == 0 { return true; }
        let ry = ((r as f64 / rows as f64) * randomized_matrix.rows as f64).floor() as usize;
        let cx = ((c as f64 / cols as f64) * randomized_matrix.cols as f64).floor() as usize;
        randomized_matrix.get(ry.min(randomized_matrix.rows-1), cx.min(randomized_matrix.cols-1)) == 1
    };

    let mut base = Vec::new();
    let mut r = min_r;
    while r <= max_r {
        let mut c = min_c;
        while c <= max_c {
            if walkable(r,c) { base.push((r,c)); }
            if max_c - c < stride { break; }
            c += stride;
        }
        if max_r - r < stride { break; }
        r += stride;
    }
    if base.len() < requested { // fall back to a full scan before declaring failure
        base.clear();
        for rr in min_r..=max_r { for cc in min_c..=max_c { if walkable(rr,cc) { base.push((rr,cc)); } } }
    }
    if base.is_empty() { return Err("没有足够的合法出生点区域".to_string()); }

    let mut candidates: Vec<Vec<(usize,usize)>> = Vec::new();
    let mut seen = HashSet::new();
    for &(r,c) in &base {
        if seen.contains(&(r,c)) { continue; }
        let mut orbit = vec![(r,c)];
        for p in get_mirrors_for_mode(r,c,rows,cols,mirroring) {
            if !seen.contains(&p) && !orbit.contains(&p) && walkable(p.0,p.1) { orbit.push(p); }
        }
        for &p in &orbit { seen.insert(p); }
        candidates.push(orbit);
    }

    // Prefer spatially fair orbits: usable terrain, away from the centre, and
    // sufficiently large symmetry orbits get a higher score.
    candidates.sort_by(|a,b| {
        let score = |o:&Vec<(usize,usize)>| {
            let d = o.iter().map(|&(r,c)| ((r as f64-center_r).powi(2)+(c as f64-center_c).powi(2)).sqrt()).sum::<f64>() / o.len() as f64;
            let pref = o.iter().filter(|&&(r,c)| preferred(r,c)).count() as f64 / o.len() as f64;
            d + pref * rows.max(cols) as f64 * 0.35 + o.len() as f64 * 0.15
        };
        score(b).partial_cmp(&score(a)).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut selected = Vec::with_capacity(requested);
    let mut used = HashSet::new();
    for orbit in &candidates {
        if selected.len() >= requested || selected.len() + orbit.len() > requested { continue; }
        if orbit.iter().any(|p| used.contains(p)) { continue; }
        if orbit.iter().any(|&p| selected.iter().any(|&q| euclidean_distance(q,p) < min_distance)) { continue; }
        for &p in orbit { selected.push(p); used.insert(p); }
    }

    // Exact-count fill. Symmetry is a preference, never a reason to silently
    // reduce the requested number of player slots.
    if selected.len() < requested {
        for &(r,c) in &base {
            if selected.len() >= requested || used.contains(&(r,c)) { continue; }
            if selected.iter().any(|&q| euclidean_distance(q,(r,c)) < min_distance) { continue; }
            selected.push((r,c)); used.insert((r,c));
        }
    }
    // Relax distance only as a last resort on extremely constrained maps.
    if selected.len() < requested {
        for &(r,c) in &base {
            if selected.len() >= requested || used.contains(&(r,c)) { continue; }
            selected.push((r,c)); used.insert((r,c));
        }
    }
    if selected.len() < requested { return Err(format!("合法区域不足：需要 {} 个出生点，实际只能放置 {} 个", requested, selected.len())); }

    // 3.3.0: write the GID whose `team` property equals the slot index (see cc_gid_for_team)
    for (i,(r,c)) in selected.iter().take(requested).enumerate() { result.set(*r,*c,cc_gid_for_team(i)); }
    Ok(result)
}

pub(crate) fn get_mirrored_positions(
    i: usize,
    j: usize,
    rows: usize,
    cols: usize,
    mirroring: &str,
) -> Vec<(usize, usize)> {
    let mut positions = vec![(i, j)];
    match mirroring {
        "horizontal" => positions.push((rows - 1 - i, j)),
        "vertical" => positions.push((i, cols - 1 - j)),
        "diagonal1" if i < cols && j < rows => positions.push((j, i)),
        "diagonal2" if j < rows && i < cols => positions.push((rows.saturating_sub(1).saturating_sub(j), cols.saturating_sub(1).saturating_sub(i))),
        "both" => {
            positions.push((rows - 1 - i, j));
            positions.push((i, cols - 1 - j));
            positions.push((rows - 1 - i, cols - 1 - j));
        }
        _ => {}
    }
    let mut dedup = Vec::new();
    let mut seen = HashSet::new();
    for p in positions {
        if seen.insert(p) {
            dedup.push(p);
        }
    }
    dedup
}



fn get_mirrors_for_mode(
    y: usize,
    x: usize,
    height: usize,
    width: usize,
    mirroring: &str,
) -> Vec<(usize, usize)> {
    if height == 0 || width == 0 { return Vec::new(); }
    let mut positions = Vec::with_capacity(4);
    let mut add = |r: usize, c: usize| {
        if r < height && c < width && !positions.contains(&(r, c)) {
            positions.push((r, c));
        }
    };
    match mirroring {
        "horizontal" => add(height - 1 - y, x),
        "vertical" => add(y, width - 1 - x),
        // Diagonal symmetry is only geometrically meaningful on square grids.
        "diagonal1" if height == width => add(x, y),
        "diagonal2" if height == width => add(width - 1 - x, height - 1 - y),
        "both" => {
            add(height - 1 - y, x);
            add(y, width - 1 - x);
            add(height - 1 - y, width - 1 - x);
        }
        _ => {}
    }
    positions
}



pub(crate) fn expand_brush(
    row: usize,
    col: usize,
    brush_size: usize,
    h: usize,
    w: usize,
) -> Vec<(usize, usize)> {
    let radius = brush_size / 2;
    let mut out = Vec::new();
    for dr in -(radius as isize)..=(radius as isize) {
        for dc in -(radius as isize)..=(radius as isize) {
            let nr = row as isize + dr;
            let nc = col as isize + dc;
            if nr >= 0 && nc >= 0 && nr < h as isize && nc < w as isize {
                out.push((nr as usize, nc as usize));
            }
        }
    }
    out
}



fn euclidean_distance(a: (usize, usize), b: (usize, usize)) -> f64 {
    let dr = a.0 as f64 - b.0 as f64;
    let dc = a.1 as f64 - b.1 as f64;
    (dr * dr + dc * dc).sqrt()
}



pub(crate) fn has_non_zero_in_radius(matrix: &Matrix, row: usize, col: usize, radius: usize) -> bool {
    let y_min = row.saturating_sub(radius);
    let y_max = (row + radius + 1).min(matrix.rows);
    let x_min = col.saturating_sub(radius);
    let x_max = (col + radius + 1).min(matrix.cols);
    for r in y_min..y_max {
        for c in x_min..x_max {
            if matrix.get(r, c) != 0 {
                return true;
            }
        }
    }
    false
}



pub(crate) fn has_positive_in_radius(matrix: &Matrix, row: usize, col: usize, radius: usize) -> bool {
    let y_min = row.saturating_sub(radius);
    let y_max = (row + radius + 1).min(matrix.rows);
    let x_min = col.saturating_sub(radius);
    let x_max = (col + radius + 1).min(matrix.cols);
    for r in y_min..y_max {
        for c in x_min..x_max {
            if matrix.get(r, c) > 0 {
                return true;
            }
        }
    }
    false
}



pub(crate) fn has_equals_one_in_radius(matrix: &Matrix, row: usize, col: usize, radius: usize) -> bool {
    let y_min = row.saturating_sub(radius);
    let y_max = (row + radius + 1).min(matrix.rows);
    let x_min = col.saturating_sub(radius);
    let x_max = (col + radius + 1).min(matrix.cols);
    for r in y_min..y_max {
        for c in x_min..x_max {
            if matrix.get(r, c) == 1 {
                return true;
            }
        }
    }
    false
}



fn is_all_land_5x5(matrix: &Matrix, r: usize, c: usize) -> bool {
    if r < 2 || c < 2 || r + 2 >= matrix.rows || c + 2 >= matrix.cols {
        return false;
    }
    for dr in -2..=2 {
        for dc in -2..=2 {
            let nr = (r as isize + dr) as usize;
            let nc = (c as isize + dc) as usize;
            if matrix.get(nr, nc) != 1 {
                return false;
            }
        }
    }
    true
}



fn fill_rect(
    mask: &mut [bool],
    cols: usize,
    start_r: usize,
    start_c: usize,
    end_r: usize,
    end_c: usize,
    value: bool,
) {
    for r in start_r..end_r {
        for c in start_c..end_c {
            if r * cols + c < mask.len() {
                mask[idx(r, c, cols)] = value;
            }
        }
    }
}



fn idx(r: usize, c: usize, cols: usize) -> usize {
    r * cols + c
}
