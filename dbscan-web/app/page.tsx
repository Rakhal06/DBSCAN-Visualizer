"use client";
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { PlotRelayoutEvent } from 'plotly.js';

// Load Plotly only on the client side
const Plot = lazy(() => import('react-plotly.js'));

// --- CONSTANTS for Algorithm Status ---
const STATUS_UNVISITED = 0;
const STATUS_NOISE = -1;
const STATUS_CHECKING = -2; // Custom status for visualization
const STATUS_CORE = -3;     // Custom status for visualization
const CLUSTER_COLORS = [ // Colors for clusters 1, 2, 3...
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f0f', '#bcbd22', '#17becf'
];
type PointType = 'Core' | 'Border' | 'Noise';

// --- DATA GENERATION (JavaScript equivalent of make_blobs/make_moons) ---
/**
 * Generates a random number following a normal distribution
 */
function randomNormal(mean = 0, stdDev = 1) {
  let u1 = Math.random();
  let u2 = Math.random();
  let randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + stdDev * randStdNormal;
}

/**
 * JS replacement for make_blobs
 */
function generateBlobs(n_samples: number, centers: number[][], cluster_std: number): number[][] {
  const points: number[][] = [];
  const pointsPerCenter = Math.floor(n_samples / centers.length);

  centers.forEach(center => {
    for (let i = 0; i < pointsPerCenter; i++) {
      points.push([
        randomNormal(center[0], cluster_std),
        randomNormal(center[1], cluster_std)
      ]);
    }
  });
  return points;
}

/**
 * NEW: JS replacement for make_circles
 */
function generateCircles(n_samples: number, noise: number): number[][] {
  const points: number[][] = [];
  const n_samples_per_circle = Math.floor(n_samples / 2);
  const inner_radius = 5;
  const outer_radius = 10;

  // Inner circle
  for (let i = 0; i < n_samples_per_circle; i++) {
    const angle = Math.random() * 2 * Math.PI;
    points.push([
      inner_radius * Math.cos(angle) + noise * randomNormal(),
      inner_radius * Math.sin(angle) + noise * randomNormal()
    ]);
  }
  // Outer circle
  for (let i = 0; i < n_samples_per_circle; i++) {
    const angle = Math.random() * 2 * Math.PI;
    points.push([
      outer_radius * Math.cos(angle) + noise * randomNormal(),
      outer_radius * Math.sin(angle) + noise * randomNormal()
    ]);
  }
  return points;
}


/**
 * Generates random noise points
 */
function generateNoise(n_samples: number, min: number[], max: number[]): number[][] {
    const points: number[][] = [];
    for (let i = 0; i < n_samples; i++) {
        points.push([
            Math.random() * (max[0] - min[0]) + min[0],
            Math.random() * (max[1] - min[1]) + min[1]
        ]);
    }
    return points;
}

// --- MAIN DATA FUNCTION ---
interface Dataset {
  points: number[][];
  features: string[]; // <-- This array holds the axis labels
}

function getDataset(datasetName: string): Dataset {
  if (datasetName === "Civil: Pothole Hotspots") {
    const centers = [[2, 2], [7, 8]];
    let X = generateBlobs(20, centers, 0.7);
    let X_noise = generateNoise(6, [0, 0], [15, 15]);
    return {
      points: [...X, ...X_noise],
      features: ['Longitude', 'Latitude'] // <-- X = Longitude, Y = Latitude
    };
  }
  // --- UPDATED: Replaced Moons with Circles ---
  else if (datasetName === "Retail: Customer Store Zones") {
    // --- FIX: Reduced noise from 0.5 to 0.1 to make circles distinct ---
    let X = generateCircles(100, 0.1); // 100 points, 0.1 noise
    let X_noise = generateNoise(10, [-15, -15], [15, 15]);
    return {
      points: [...X, ...X_noise],
      features: ['Distance from Aisle 1', 'Distance from Aisle 5'] 
    };
  }
  else if (datasetName === "Sports: Shot Chart Hotspots") {
    const centers = [[0, 5], [-20, 15]];
    let X = generateBlobs(20, centers, 1.2);
    let X_noise = generateNoise(7, [-30, 0], [30, 30]);
    return {
      points: [...X, ...X_noise],
      features: ['X Coordinate', 'Y Coordinate'] // <-- X = X Coordinate, Y = Y Coordinate
    };
  }
  // --- NEW: Fourth dataset (mostly noise) ---
  else if (datasetName === "Astro: Deep Space Signals") {
    let X_noise = generateNoise(100, [0, 0], [20, 20]); // Just a bunch of noise
    return {
      points: X_noise,
      features: ['Signal Frequency (GHz)', 'Signal Strength (dBm)']
    };
  }
  return {
    points: [[1, 1], [1.5, 1.8], [5, 8], [8, 8], [1, 0.6], [9, 11]],
    features: ['X', 'Y']
  };
}
// --- END DATA GENERATION ---


// --- Text/Analogy Functions ---
function getAnalogyExplanation(datasetName: string) {
  switch (datasetName) {
    case "Civil: Pothole Hotspots":
      return {
        problem: "We have GPS coordinates of potholes. We need to find *hotspots*—dense areas—to schedule priority repairs.",
        epsilon: "This is our 'inspection radius' (e.g., 50 meters). Potholes within this radius are considered 'neighbors'.",
        minPts: "This is the 'critical mass' (e.g., 5 potholes). A pothole needs this many neighbors to be a 'core' hotspot.",
        core: "A *Core Point* (●) is the center of a hotspot. A pothole with many others right next to it. High priority.",
        border: "A *Border Point* (■) is on the edge of a hotspot. It's part of the zone but not the center.",
        noise: "A *Noise Point* (X) is an isolated pothole. It's not part of a dense cluster. Lower priority."
      };
    // --- UPDATED: Replaced Bio-Chem with Retail ---
    case "Retail: Customer Store Zones":
      return {
        problem: "We have data on where customers walk in a store. We need to find if there are two distinct 'zones' of activity (e.g., an 'inner' zone and an 'outer' zone).",
        epsilon: "The 'browsing distance.' How close customers must be to be considered in the same 'group'.",
        minPts: "The 'crowd size.' How many customers are needed to be a 'core' activity spot.",
        core: "A *Hotspot* (●). A spot in the store where many customers are browsing closely together.",
        border: "A *Nearby Shopper* (■). A customer on the edge of a busy zone, but not in the center of it.",
        noise: "An *Outlier Shopper* (X). A customer walking in an empty part of the store, far from any group."
      };
    case "Sports: Shot Chart Hotspots":
      return {
        problem: "We have the court coordinates of every shot a player took. We need to find their 'hotspots'—their favorite spots.",
        epsilon: "This is the 'shooting pocket' radius. How close shots must be to be from the same 'spot'.",
        minPts: "This is the 'shot frequency' threshold. How many shots are needed to make a 'core' hotspot.",
        core: "A *Sweet Spot* (●). A shot from the center of their high-volume zone.",
        border: "A *'Near' Shot* (■). A shot still in their comfort zone, but on the edge, not their 'go-to' spot.",
        noise: "An *Unusual Shot* (X). A rare attempt from a part of the court they don't normally shoot from."
      };
    // --- NEW: Analogy for 4th dataset ---
    case "Astro: Deep Space Signals":
      return {
        problem: "We're scanning deep space for signals. We need to find *patterns* or *clusters* of signals, or determine if it's all just random noise.",
        epsilon: "The 'signal similarity' radius. How close in frequency and strength signals must be to be considered 'related'.",
        minPts: "The 'pattern threshold.' How many related signals are needed to be a 'core' finding.",
        core: "A *Core Signal* (●). A signal that is part of a dense, repeating pattern. A potential discovery!",
        border: "A *Related Signal* (■). A signal on the edge of a pattern, but not the main source.",
        noise: "A *Random Signal* (X). Just background static. This is what most of our data will be."
      };
    default:
      return { problem: "", epsilon: "", minPts: "", core: "", border: "", noise: "" };
  }
}

// Get score explanation
function getScoreExplanation(datasetName: string): string {
  switch (datasetName) {
    case "Civil: Pothole Hotspots":
      return "A high score means we've clearly identified separate pothole hotspots.";
    // --- UPDATED: Replaced Bio-Chem with Retail ---
    case "Retail: Customer Store Zones":
      return "A high score means we've found distinct, well-separated shopping zones. (Note: K-Means will fail here!)";
    case "Sports: Shot Chart Hotspots":
      return "A high score means we've found well-defined shooting 'hotspots'.";
    // --- NEW: Score explanation for 4th dataset ---
    case "Astro: Deep Space Signals":
      return "A high score is *unlikely*. We expect most of this to be noise, so a 'null' or very low score is the *correct* result.";
    default:
      return "A high score means the clusters are dense and well-separated.";
  }
}
// --- END Text/Analogy ---


// --- JS Standard Scaler ---
class StandardScaler {
  mean: number[];
  scale: number[];

  constructor() {
    this.mean = [];
    this.scale = [];
  }

  fit(data: number[][]) {
    const n_features = data[0].length;
    this.mean = Array(n_features).fill(0);
    this.scale = Array(n_features).fill(0);
    data.forEach(row => {
      row.forEach((val, i) => {
        this.mean[i] += val;
      });
    });
    this.mean = this.mean.map(m => m / data.length);
    data.forEach(row => {
      row.forEach((val, i) => {
        this.scale[i] += Math.pow(val - this.mean[i], 2);
      });
    });
    this.scale = this.scale.map(s => Math.sqrt(s / data.length));
    this.scale = this.scale.map(s => s === 0 ? 1 : s);
  }

  transform(data: number[][]): number[][] {
    return data.map(row => 
      row.map((val, i) => (val - this.mean[i]) / this.scale[i])
    );
  }

  fit_transform(data: number[][]): number[][] {
    this.fit(data);
    return this.transform(data);
  }
}
// --- END Standard Scaler ---


// --- DBSCAN ALGORITHM & HELPERS ---
function euclideanDistance(p1: number[], p2: number[]): number {
  return Math.sqrt(p1.reduce((sum, val, i) => sum + Math.pow(val - p2[i], 2), 0));
}

function getNeighbors(X_scaled: number[][], point_index: number, eps: number): number[] {
  const neighbors: number[] = [];
  const point = X_scaled[point_index];
  for (let i = 0; i < X_scaled.length; i++) {
    if (euclideanDistance(point, X_scaled[i]) < eps) {
      neighbors.push(i);
    }
  }
  return neighbors;
}

/**
 * VISUAL generator function for animation
 */
function* runDBSCAN(X_scaled: number[][], eps: number, min_pts: number) {
  const n_points = X_scaled.length;
  const labels = Array(n_points).fill(STATUS_UNVISITED);
  let cluster_id = 0;

  for (let i = 0; i < n_points; i++) {
    if (labels[i] !== STATUS_UNVISITED) continue;

    labels[i] = STATUS_CHECKING;
    const neighbors = getNeighbors(X_scaled, i, eps);

    yield {
      title: `Checking Point ${i}...`,
      labels: [...labels],
      checking_point: i,
    };

    if (neighbors.length < min_pts) {
      labels[i] = STATUS_NOISE;
      yield {
        title: `Point ${i} is Noise (Neighbors < ${min_pts})`,
        labels: [...labels],
        checking_point: null,
      };
    } else {
      cluster_id++;
      labels[i] = cluster_id;
      
      const temp_labels = [...labels];
      temp_labels[i] = STATUS_CORE;
      yield {
        title: `Point ${i} is a Core Point! Starting Cluster ${cluster_id}`,
        labels: temp_labels,
        checking_point: i,
      };
      
      let queue = neighbors.filter(n => n !== i);
      let q_index = 0;
      
      while(q_index < queue.length) {
        const point_index = queue[q_index];
        q_index++;

        if (labels[point_index] === STATUS_NOISE) {
          labels[point_index] = cluster_id;
          yield {
            title: `Expanding Cluster ${cluster_id}... (Noise point ${point_index} becomes border)`,
            labels: [...labels],
            checking_point: null,
          };
        }

        if (labels[point_index] === STATUS_UNVISITED) {
          labels[point_index] = cluster_id;
          yield {
            title: `Expanding Cluster ${cluster_id}... (Adding point ${point_index})`,
            labels: [...labels],
            checking_point: null,
          };

          const new_neighbors = getNeighbors(X_scaled, point_index, eps);
          if (new_neighbors.length >= min_pts) {
            new_neighbors.forEach(n => {
              if ((labels[n] === STATUS_UNVISITED || labels[n] === STATUS_NOISE) && !queue.includes(n)) {
                queue.push(n);
              }
            });
          }
        }
      }
    }
  }

  yield {
    title: "Algorithm Complete!",
    labels: [...labels],
    checking_point: null,
  };
}

/**
 * NON-VISUAL, fast DBSCAN for parameter search.
 * Returns only the final labels array.
 */
function runDBSCAN_direct(X_scaled: number[][], eps: number, min_pts: number): number[] {
  const n_points = X_scaled.length;
  const labels = Array(n_points).fill(STATUS_UNVISITED);
  let cluster_id = 0;

  for (let i = 0; i < n_points; i++) {
    if (labels[i] !== STATUS_UNVISITED) continue;
    
    const neighbors = getNeighbors(X_scaled, i, eps);

    if (neighbors.length < min_pts) {
      labels[i] = STATUS_NOISE;
    } else {
      cluster_id++;
      labels[i] = cluster_id;
      
      let queue = neighbors.filter(n => n !== i);
      let q_index = 0;
      
      while(q_index < queue.length) {
        const point_index = queue[q_index];
        q_index++;

        if (labels[point_index] === STATUS_NOISE) {
          labels[point_index] = cluster_id;
        }

        if (labels[point_index] === STATUS_UNVISITED) {
          labels[point_index] = cluster_id;
          const new_neighbors = getNeighbors(X_scaled, point_index, eps);
          if (new_neighbors.length >= min_pts) {
            new_neighbors.forEach(n => {
              if ((labels[n] === STATUS_UNVISITED || labels[n] === STATUS_NOISE) && !queue.includes(n)) {
                queue.push(n);
              }
            });
          }
        }
      }
    }
  }
  return labels;
}


function calculatePointTypes(X_scaled: number[][], labels: number[], eps: number, min_pts: number): PointType[] {
  return labels.map((label, i) => {
    if (label === STATUS_NOISE) {
      return 'Noise';
    }
    const neighbors = getNeighbors(X_scaled, i, eps);
    if (neighbors.length >= min_pts) {
      return 'Core';
    }
    return 'Border';
  });
}
// --- END DBSCAN/HELPERS ---

// --- K-MEANS ALGORITHM ---
/**
 * A simple K-Means implementation
 * Returns cluster labels [0, 1, ..., k-1]
 */
function runKMeans(X_scaled: number[][], k: number, max_iters: number): number[] {
  const n_points = X_scaled.length;
  const n_features = X_scaled[0].length;
  
  // 1. Initialize centroids by picking k random points from data
  let centroids: number[][] = [];
  const initialIndices = new Set<number>();
  while (initialIndices.size < k) {
    initialIndices.add(Math.floor(Math.random() * n_points));
  }
  centroids = Array.from(initialIndices).map(i => [...X_scaled[i]]);

  let labels = Array(n_points).fill(0);
  let changed = true;

  for (let iter = 0; iter < max_iters && changed; iter++) {
    changed = false;
    
    // 2. Assign points to closest centroid
    for (let i = 0; i < n_points; i++) {
      let min_dist = Infinity;
      let new_label = 0;
      for (let j = 0; j < k; j++) {
        const dist = euclideanDistance(X_scaled[i], centroids[j]);
        if (dist < min_dist) {
          min_dist = dist;
          new_label = j;
        }
      }
      if (labels[i] !== new_label) {
        labels[i] = new_label;
        changed = true;
      }
    }

    // 3. Update centroids
    for (let j = 0; j < k; j++) {
      const cluster_points = X_scaled.filter((_, i) => labels[i] === j);
      if (cluster_points.length > 0) {
        const new_centroid = Array(n_features).fill(0);
        for (const point of cluster_points) {
          for (let f = 0; f < n_features; f++) {
            new_centroid[f] += point[f];
          }
        }
        centroids[j] = new_centroid.map(val => val / cluster_points.length);
      }
    }
  }
  
  // Return labels + 1 (so they become 1 and 2, matching DBSCAN)
  return labels.map(l => l + 1);
}
// --- END K-MEANS ALGORITHM ---


// --- SILHOUETTE SCORE (HAPPINESS SCORE) ---
// This is still used for the *manual run* metric

function meanIntraClusterDistance(i: number, X_scaled: number[][], labels: number[]): number {
  const point = X_scaled[i];
  const clusterId = labels[i];
  let totalDistance = 0;
  let count = 0;

  for (let j = 0; j < X_scaled.length; j++) {
    if (i !== j && labels[j] === clusterId) {
      totalDistance += euclideanDistance(point, X_scaled[j]);
      count++;
    }
  }
  return count === 0 ? 0 : totalDistance / count;
}

function meanNearestClusterDistance(i: number, X_scaled: number[][], labels: number[], clusterIds: number[]): number {
  const point = X_scaled[i];
  const myClusterId = labels[i];
  let minMeanDistance = Infinity;

  for (const clusterId of clusterIds) {
    if (clusterId === myClusterId) continue;

    let totalDistance = 0;
    let count = 0;
    for (let j = 0; j < X_scaled.length; j++) {
      if (labels[j] === clusterId) {
        totalDistance += euclideanDistance(point, X_scaled[j]);
        count++;
      }
    }
    
    if (count > 0) {
      const meanDistance = totalDistance / count;
      if (meanDistance < minMeanDistance) {
        minMeanDistance = meanDistance;
      }
    }
  }
  return minMeanDistance;
}

function calculatePointSilhouette(i: number, X_scaled: number[][], labels: number[], clusterIds: number[]): number {
  const a = meanIntraClusterDistance(i, X_scaled, labels);
  const b = meanNearestClusterDistance(i, X_scaled, labels, clusterIds);

  if (a === Infinity || b === Infinity) return 0;
  if (a === 0 && b === 0) return 0;
  
  return (b - a) / Math.max(a, b);
}

function calculateSilhouetteScore(X_scaled: number[][], labels: number[]): number | null {
  const clusterIds = [...new Set(labels)].filter(id => id > 0);
  
  if (clusterIds.length < 2) {
    return null;
  }

  let totalScore = 0;
  let validPoints = 0;

  for (let i = 0; i < X_scaled.length; i++) {
    if (labels[i] > 0) {
      totalScore += calculatePointSilhouette(i, X_scaled, labels, clusterIds);
      validPoints++;
    }
  }

  return validPoints === 0 ? null : totalScore / validPoints;
}
// --- END SILHOUETTE SCORE ---

// --- START: NEW DATASET-AWARE SCORING (FOR BEST PARAM SEARCH) ---

/**
 * Helper: Computes the centroid of a set of points
 */
function computeClusterCentroid(points: number[][]): number[] {
  const n = points.length;
  if (n === 0) return [0, 0]; // Should not happen if labels are > 0
  const s = points.reduce((agg, p) => [agg[0] + p[0], agg[1] + p[1]], [0, 0]);
  return [s[0] / n, s[1] / n];
}

/**
 * Fallback Score: DBCV-like approximation
 * Scores density and separation. Good fallback for non-spherical blobs.
 * Returns [0, 1] or null if no clusters.
 */
function dbcvApproxScore(X_scaled: number[][], labels: number[]): number | null {
  const clusterIds = [...new Set(labels)].filter((id) => id > 0);
  if (clusterIds.length < 1) return null; // No clusters found

  const clusters = clusterIds.map((id) => {
    const pts = X_scaled.filter((_, i) => labels[i] === id);
    const centroid = computeClusterCentroid(pts);
    // Avg distance from centroid (intra-cluster "spread")
    const avgIntra = pts.reduce((s, p) => s + euclideanDistance(p, centroid), 0) / Math.max(1, pts.length);
    // Simple density = num points / spread
    const density = pts.length / (avgIntra + 1e-9); 
    return { id, pts, centroid, avgIntra, density };
  });

  // Find min distance between any two cluster centroids
  let minCentroidDist = Infinity;
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const d = euclideanDistance(clusters[i].centroid, clusters[j].centroid);
      if (d < minCentroidDist) minCentroidDist = d;
    }
  }

  // Handle single cluster case
  if (clusters.length === 1) {
    minCentroidDist = 0.0; // One cluster has 0 separation
  } else {
    minCentroidDist = isFinite(minCentroidDist) ? minCentroidDist : 0.0;
  }
  
  const meanDensity = clusters.reduce((s, c) => s + c.density, 0) / clusters.length;
  const noiseCount = labels.filter((l) => l === STATUS_NOISE).length;
  
  // Penalize noise heavily (but not 0, as some noise is good)
  const noisePenalty = 1 - (noiseCount / labels.length); 
  
  // Use tanh to map density and separation to [0, 1] range
  const densityTerm = Math.tanh(meanDensity * 0.1);
  const sepTerm = Math.tanh(minCentroidDist * 0.5);

  // Weighted average: Density is most important, then separation, then noise
  const score = 0.55 * densityTerm + 0.35 * sepTerm + 0.10 * noisePenalty;
  
  return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
}


/**
 * Score for "Retail: Customer Store Zones"
 * This score is *designed* to find two well-separated rings.
 * It calculates the "spread" (avg. radius) of the two largest clusters.
 * A high score means the two spreads are very different (e.g., small inner ring, large outer ring).
 * Returns score [0, 1] or -1 if < 2 clusters are found.
 */
function retailDensityScore(X_scaled: number[][], labels: number[]): number {
  const clusterIds = [...new Set(labels)].filter((id) => id > 0);
  
  // We MUST find at least two clusters (inner and outer ring)
  if (clusterIds.length < 2) return -1.0;

  // Find the two *largest* clusters (to ignore tiny noise clusters)
  const clusterSizes = clusterIds.map(id => ({
    id: id,
    size: labels.filter(l => l === id).length
  }));
  clusterSizes.sort((a, b) => b.size - a.size); // Sort descending by size
  
  const topTwoClusterIds = [clusterSizes[0].id, clusterSizes[1].id];

  // Get the points for the two largest clusters
  const pts = topTwoClusterIds.map(id => 
    X_scaled.filter((_, i) => labels[i] === id)
  );

  // Calculate the average "spread" (like a radius) for each cluster
  const spreads = pts.map((arr) => {
    const centroid = computeClusterCentroid(arr);
    // Avg distance from centroid
    return arr.reduce((s, p) => s + euclideanDistance(p, centroid), 0) / arr.length;
  });

  // Separation = difference in the two "radii"
  const separation = Math.abs(spreads[0] - spreads[1]);

  // Normalize: In scaled units, the two radii are ~5 and ~10
  // Scaled radii are ~1.5 and ~3.0. Separation is ~1.5
  // We'll normalize by 1.5 to get a score [0, 1]
  return Math.min(separation / 1.5, 1.0);
}

/**
 * Score for "Astro: Deep Space Signals"
 * This score *rewards* finding 0 clusters.
 * Returns 1.0 if 0 clusters are found, -1.0 otherwise.
 */
function astroScore(labels: number[]): number {
  const clusterCount = new Set(labels.filter((l) => l > 0)).size;
  return clusterCount === 0 ? 1.0 : -1.0;
}

/**
 * MASTER SCORING FUNCTION
 * This function decides *which* score to use for the "Best Parameter" search.
 */
function scoreClusters(datasetName: string, X_scaled: number[][], labels: number[]): number {
  try {
    switch (datasetName) {
      case "Astro: Deep Space Signals": {
        // This dataset *wants* to find 0 clusters.
        return astroScore(labels);
      }
      
      case "Retail: Customer Store Zones": {
        // This dataset *wants* to find two rings. Use the special score.
        const rScore = retailDensityScore(X_scaled, labels);
        // If it fails (e.g., finds 1 cluster), fallback to DBCV
        if (rScore >= 0) return rScore;
        const dbcv = dbcvApproxScore(X_scaled, labels);
        return dbcv === null ? -1 : dbcv;
      }

      case "Civil: Pothole Hotspots":
      case "Sports: Shot Chart Hotspots": {
        // These are blob-like, so Silhouette is a good metric.
        const sil = calculateSilhouetteScore(X_scaled, labels);
        if (sil !== null) return sil; // Returns [-1, 1]
        // Fallback to DBCV if silhouette fails
        const dbcv = dbcvApproxScore(X_scaled, labels);
        return dbcv === null ? -1 : (dbcv * 2 - 1); // Scale DBCV to [-1, 1]
      }

      default: {
        // Default fallback for any other dataset
        const sil = calculateSilhouetteScore(X_scaled, labels);
        if (sil !== null) return sil;
        const dbcv = dbcvApproxScore(X_scaled, labels);
        return dbcv === null ? -1 : (dbcv * 2 - 1);
      }
    }
  } catch (e) {
    // Failsafe
    return -1;
  }
}

// --- END: NEW DATASET-AWARE SCORING ---


// --- BEST PARAMETER FINDER (UPDATED) ---
interface BestParamData {
  eps: number;
  minPts: number;
  score: number;
  labels: number[];
}

/**
 * findBestParameters: Uses new dataset-aware scoring
 */
function findBestParameters(X_scaled: number[][], datasetName: string): BestParamData | null {
  // --- NEW: Dataset-specific search ranges ---
  const eps_range =
    datasetName === "Retail: Customer Store Zones"
      ? [0.3, 0.4, 0.5, 0.6] // Tighter range for circles
      : datasetName === "Astro: Deep Space Signals"
      ? [0.2, 0.3, 0.4, 0.5] // Range to find noise
      : [0.2, 0.4, 0.6, 0.8, 1.0]; // Default for blobs

  const min_pts_range =
    datasetName === "Retail: Customer Store Zones"
      ? [4, 5, 6]
      : [3, 4, 5, 6, 7]; // Default

  let bestScore = -Infinity; // Use -Infinity to handle [-1, 1] scores
  let bestParams: BestParamData | null = null;

  for (const eps of eps_range) {
    for (const minPts of min_pts_range) {
      const labels = runDBSCAN_direct(X_scaled, eps, minPts);
      // --- NEW: Use the master scoring function ---
      const score = scoreClusters(datasetName, X_scaled, labels);

      if (score > bestScore) {
        bestScore = score;
        bestParams = { eps, minPts, score, labels };
      }
    }
  }
  return bestParams;
}
// --- END BEST PARAMETER FINDER ---


// --- TYPES ---
interface Dataset {
  points: number[][];
  features: string[];
}
interface PlotFrame {
  title: string;
  labels: number[];
  checking_point: number | null;
}
// Grid Plot type
interface GridPlotData {
  traces: any[];
  title: string;
}

// --- REACT COMPONENT ---
export default function Home() {
  // --- STATE ---
  const [datasetChoice, setDatasetChoice] = useState("Civil: Pothole Hotspots");
  const [epsilon, setEpsilon] = useState(0.5);
  const [minPts, setMinPts] = useState(4);
  const [plotData, setPlotData] = useState<Dataset>({ points: [], features: ['X', 'Y'] });
  const [scaler, setScaler] = useState<StandardScaler | null>(null);

  // --- ANIMATION STATE ---
  const [isAnimating, setIsAnimating] = useState(false);
  const [plotFrames, setPlotFrames] = useState<PlotFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animationTitle, setAnimationTitle] = useState("");
  
  // --- FINAL RESULT STATE ---
  const [finalLabels, setFinalLabels] = useState<number[] | null>(null);
  const [pointTypes, setPointTypes] = useState<PointType[] | null>(null);
  const [silhouetteScore, setSilhouetteScore] = useState<number | null>(null); // This is for the *manual run*

  // --- BEST PARAM STATE ---
  const [isSearching, setIsSearching] = useState(false);
  const [bestParams, setBestParams] = useState<BestParamData | null>(null); // This stores the *advanced score*
  const [bestPlotTraces, setBestPlotTraces] = useState<any[]>([]);

  // --- 2x2 GRID STATE ---
  const [gridPlots, setGridPlots] = useState<GridPlotData[]>([]);

  // --- HOVER STATE ---
  const [hoverLines, setHoverLines] = useState<any[]>([]);

  // --- K-MEANS vs DBSCAN PLOT STATE ---
  const [kMeansPlotTraces, setKMeansPlotTraces] = useState<any[]>([]);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  // --- CLIENT-SIDE STATE ---
  const [isClient, setIsClient] = useState(false);

  // Get analogy text
  const analogy = getAnalogyExplanation(datasetChoice);
  const scoreExplanation = getScoreExplanation(datasetChoice);

  // Use a ref for the animation timer
  const animationTimer = useRef<NodeJS.Timeout | null>(null);

  // --- EFFECT for DATASET CHANGE ---
  useEffect(() => {
    stopAnimation(false); // Stop animation, don't calc final
    setBestParams(null); // Clear best params
    setBestPlotTraces([]); // Clear best plot
    setGridPlots([]); // Clear grid plots
    setKMeansPlotTraces([]); // Clear K-Means plot
    
    const newData = getDataset(datasetChoice);
    setPlotData(newData);
    
    const newScaler = new StandardScaler();
    newScaler.fit(newData.points);
    setScaler(newScaler);

    // --- NEW: Set smart default epsilon for manual slider ---
    if (datasetChoice === "Retail: Customer Store Zones") {
      setEpsilon(0.5); // A good default to find rings
    } else if (datasetChoice === "Astro: Deep Space Signals") {
      setEpsilon(0.3); // A low default
    } else {
      setEpsilon(0.5); // Default for blobs
    }
  }, [datasetChoice]);

  // --- EFFECT TO CHECK FOR CLIENT ---
  useEffect(() => {
    setIsClient(true);
  }, []);

  // --- EFFECT for ANIMATION ---
  useEffect(() => {
    if (isAnimating) {
      animationTimer.current = setInterval(() => {
        setCurrentFrame(prevFrame => {
          const nextFrame = prevFrame + 1;
          if (nextFrame >= plotFrames.length) {
            stopAnimation(true); // Animation finished, calc final
            return prevFrame;
          }
          setAnimationTitle(plotFrames[nextFrame].title);
          return nextFrame;
        });
      }, 500); // 500ms per step
    } else {
      if (animationTimer.current) {
        clearInterval(animationTimer.current);
        animationTimer.current = null;
      }
    }
    return () => { // Cleanup
      if (animationTimer.current) {
        clearInterval(animationTimer.current);
      }
    };
  // FIX: This hook should not depend on stopAnimation
  }, [isAnimating, plotFrames]);

  // --- EFFECT for BEST PARAM & GRID SEARCH (AND K-MEANS) ---
  useEffect(() => {
    if (!scaler) return; // Wait for scaler to be set

    setIsSearching(true);
    setBestParams(null);
    setBestPlotTraces([]);
    setGridPlots([]); // Clear grid plots
    setKMeansPlotTraces([]); // Clear K-Means plot

    // Run search in a timeout to let UI update (show loading)
    setTimeout(() => {
      // Use plotData from state, which is guaranteed to be up-to-date here
      const X_scaled = scaler.transform(plotData.points); 
      
      // 1. Find Best (for DBSCAN)
      // --- UPDATED: Pass datasetChoice to new parameter search ---
      const best = findBestParameters(X_scaled, datasetChoice);
      setBestParams(best);

      // --- K-MEANS COMPARISON LOGIC ---
      // --- UPDATED: Changed from "Bio-Chem" to "Retail" ---
      if (datasetChoice === "Retail: Customer Store Zones") {
        const kMeansLabels = runKMeans(X_scaled, 2, 100); // Returns [1, 2]
        const kMeansTraces = createPlotlyTraces(plotData.points, kMeansLabels);
        setKMeansPlotTraces(kMeansTraces); // Store K-Means plot
      }
      // --- END NEW LOGIC ---

      // 2. Generate 2x2 Grid Plots
      const gridParams = [
        { eps: 0.3, minPts: 3, titlePrefix: "Low ε (0.3), Low MinPts (3)" },
        { eps: 0.8, minPts: 3, titlePrefix: "High ε (0.8), Low MinPts (3)" },
        { eps: 0.3, minPts: 7, titlePrefix: "Low ε (0.3), High MinPts (7)" },
        { eps: 0.8, minPts: 7, titlePrefix: "High ε (0.8), High MinPts (7)" },
      ];
      
      const newGridPlots = gridParams.map(params => {
        const labels = runDBSCAN_direct(X_scaled, params.eps, params.minPts);
        const traces = createPlotlyTraces(plotData.points, labels); // Use helper, no pointTypes
        
        // --- Calculate stats for title ---
        // --- UPDATED: Use new master score for grid plots ---
        const score = scoreClusters(datasetChoice, X_scaled, labels);
        const n_clusters = Math.max(...labels) > 0 ? Math.max(...labels) : 0;
        const n_noise = labels.filter(l => l === STATUS_NOISE).length;
        
        const scoreStr = score !== null ? `Happiness: ${score.toFixed(2)}` : 'Happiness: N/A';
        const titleText = `<b>${params.titlePrefix}</b><br><sup>${n_clusters} clusters, ${n_noise} noise | ${scoreStr}</sup>`;
        
        return { traces, title: titleText }; // Return new dynamic title text
      });
      
      setGridPlots(newGridPlots);
      setIsSearching(false);
    }, 100); // 100ms delay
  // --- FIX: This hook should *only* run when scaler or plotData change. ---
  // Adding datasetChoice here is correct, as the search logic depends on it.
  }, [scaler, plotData, datasetChoice]);

  // --- EFFECT to create BEST PLOT traces (with shapes) ---
  useEffect(() => {
    if (!bestParams || !scaler) {
      setBestPlotTraces([]);
      return;
    }

    // --- FIX: Add guard clause to prevent race condition ---
    // This ensures plotData and bestParams are in sync before calculating
    if (plotData.points.length !== bestParams.labels.length) {
      return; // Do nothing, wait for the other useEffect to update bestParams
    }

    const X_scaled = scaler.transform(plotData.points);
    const pointTypes = calculatePointTypes(X_scaled, bestParams.labels, bestParams.eps, bestParams.minPts);
    const traces = createPlotlyTraces(plotData.points, bestParams.labels, pointTypes); // Use helper
    setBestPlotTraces(traces);

  // --- FIX: This hook should only run when its dependencies change. ---
  }, [bestParams, scaler, plotData]);


  // --- ANIMATION HANDLERS ---
  const stopAnimation = (calculateFinal: boolean) => {
    setIsAnimating(false);
    
    if (calculateFinal && plotFrames.length > 0 && scaler) {
      const lastFrame = plotFrames[plotFrames.length - 1];
      const X_scaled = scaler.transform(plotData.points);
      const types = calculatePointTypes(X_scaled, lastFrame.labels, epsilon, minPts);
      // --- NOTE: Manual run still uses Silhouette for simplicity ---
      const score = calculateSilhouetteScore(X_scaled, lastFrame.labels);
      
      setFinalLabels(lastFrame.labels);
      setPointTypes(types);
      setSilhouetteScore(score); // This is the *manual* score
    } else {
      setFinalLabels(null);
      setPointTypes(null);
      setSilhouetteScore(null);
    }
    
    setCurrentFrame(0);
    setPlotFrames([]);
    setAnimationTitle("");
    if (animationTimer.current) {
      clearInterval(animationTimer.current);
      animationTimer.current = null;
    }
  }
  
  const handleRunAnimation = () => {
    if (isAnimating) {
      stopAnimation(false);
      return;
    }
    if (!scaler) return;

    setFinalLabels(null);
    setPointTypes(null);
    setSilhouetteScore(null);
    
    const X_scaled = scaler.transform(plotData.points);
    const generator = runDBSCAN(X_scaled, epsilon, minPts);
    const frames: PlotFrame[] = Array.from(generator);
    setPlotFrames(frames);
    
    setCurrentFrame(0);
    setAnimationTitle(frames[0]?.title || "Starting...");
    setIsAnimating(true);
  }

  // --- HOVER HANDLER ---
  const handlePlotHover = (eventData: any) => {
    if (isAnimating || !scaler || !plotData) return; // Don't do this during animation or if data isn't ready

    if (!eventData || !eventData.points || eventData.points.length === 0) {
      // This is an "un-hover" event
      if (hoverLines.length > 0) { // Only update state if needed
        setHoverLines([]);
      }
      return;
    }

    // Find the original point index
    const point = eventData.points[0];
    const pointX = point.x;
    const pointY = point.y;
    
    // Find the index in the original plotData.points
    const pointIndex = plotData.points.findIndex(p => p[0] === pointX && p[1] === pointY);

    if (pointIndex === -1) {
        if (hoverLines.length > 0) {
            setHoverLines([]); // Clear lines if invalid point
        }
        return;
    }

    // Re-calculate neighbors based on current epsilon
    const X_scaled = scaler.transform(plotData.points);
    const neighbors = getNeighbors(X_scaled, pointIndex, epsilon);
    const hoveredPoint = plotData.points[pointIndex];

    const newLines = neighbors
      .map(neighborIndex => {
        if (neighborIndex === pointIndex) return null; // Don't draw a line to itself
        const neighborPoint = plotData.points[neighborIndex];
        return {
          type: 'line',
          xref: 'x', yref: 'y',
          x0: hoveredPoint[0],
          y0: hoveredPoint[1],
          x1: neighborPoint[0],
          y1: neighborPoint[1],
          line: {
            color: 'rgba(255, 0, 0, 0.7)', // Bright red for visibility
            width: 2,
            dash: 'dot'
          }
        };
      })
      .filter(Boolean); // Remove nulls

    // Simple check to avoid unnecessary re-renders if lines are identical
    if (JSON.stringify(newLines) !== JSON.stringify(hoverLines)) {
        setHoverLines(newLines as any[]);
    }
  };
  
  // --- Reusable function to create plot traces (FIXED) ---
  function createPlotlyTraces(points: number[][], labels: number[], pointTypes?: PointType[]): any[] {
    const traces: any[] = [];
    const traceMap: { [key: string]: { x: number[], y: number[], color: string, symbol: string, size: number }} = {};

    points.forEach((point, i) => {
      const label = labels[i];
      // Check if label is valid, default to noise if not (e.g., K-Means 0)
      const color = (label <= 0) ? 'rgb(0, 0, 0)' : CLUSTER_COLORS[(label - 1) % CLUSTER_COLORS.length];
      
      let key = "";
      let symbol = "circle";
      let size = 10;

      if (pointTypes) {
        // --- Detailed key for Main Plot and Best Plot (DBSCAN) ---
        const type = pointTypes[i];
        symbol = (type === 'Noise') ? 'x' : (type === 'Border') ? 'square' : 'circle';
        size = (type === 'Noise') ? 8 : 10;
        key = label === STATUS_NOISE ? "Noise" : `Cluster ${label} - ${type}`;
      } else {
        // --- Simple key for 2x2 Grid (DBSCAN) and K-Means plot ---
        symbol = (label <= 0) ? 'x' : 'circle';
        size = (label <= 0) ? 8 : 10;
        key = (label <= 0) ? "Noise" : `Cluster ${label}`; // K-Means 1 and 2 will be "Cluster 1" "Cluster 2"
      }


      if (!traceMap[key]) {
        traceMap[key] = { x: [], y: [], color: color, symbol: symbol, size: size };
      }
      traceMap[key].x.push(point[0]);
      traceMap[key].y.push(point[1]);
    });

    for (const key in traceMap) {
      traces.push({
        name: key,
        x: traceMap[key].x,
        y: traceMap[key].y,
        mode: 'markers',
        type: 'scatter',
        marker: {
          color: traceMap[key].color, // Use single color for whole trace
          size: traceMap[key].size,
          symbol: traceMap[key].symbol
        }
      });
    }
    return traces;
  }
  
  // --- Plotly Data Helper ---
  const getPlotlyData = () => {
    // 1. Show Animation Frame
    if (isAnimating && plotFrames.length > 0) {
      const frame = plotFrames[currentFrame];
      const colors = frame.labels.map(label => {
        if (label === STATUS_UNVISITED) return 'rgb(200, 200, 200)';
        if (label === STATUS_NOISE) return 'rgb(0, 0, 0)';
        if (label === STATUS_CHECKING) return 'rgb(255, 0, 0)';
        if (label === STATUS_CORE) return 'rgb(0, 255, 0)';
        return CLUSTER_COLORS[(label - 1) % CLUSTER_COLORS.length];
      });
      const symbols = frame.labels.map(label => 
        label === STATUS_NOISE ? 'x' : 'circle'
      );
      const sizes = frame.labels.map((label, i) => 
        i === frame?.checking_point || label === STATUS_CHECKING || label === STATUS_CORE
        ? 16 : 10
      );
      return [{
        x: plotData.points.map(p => p[0]),
        y: plotData.points.map(p => p[1]),
        mode: 'markers',
        type: 'scatter',
        hoverinfo: 'none', // Disable hover during animation
        marker: { color: colors, size: sizes, symbol: symbols }
      }];
    }
    
    // 2. Show Final Result Plot
    if (!isAnimating && finalLabels && pointTypes) {
      return createPlotlyTraces(plotData.points, finalLabels, pointTypes);
    }

    // 3. Show Default Raw Data
    return [{
      x: plotData.points.map(p => p[0]),
      y: plotData.points.map(p => p[1]),
      mode: 'markers',
      type: 'scatter',
      name: 'Raw Data',
      marker: { size: 10, color: 'rgb(150, 150, 150)' }
    }];
  }

  // --- Plotly Layout Helper ---
  const getPlotlyLayout = () => {
    let titleText = ""; // Changed to titleText
    if (isAnimating) {
      titleText = animationTitle;
    } else if (finalLabels) {
      const n_clusters = Math.max(...finalLabels);
      const n_noise = finalLabels.filter(l => l === STATUS_NOISE).length;
      titleText = `Final Result: Found ${n_clusters > 0 ? n_clusters : 0} cluster(s) and ${n_noise} noise points.`;
    } else {
      titleText = `Raw Data: ${datasetChoice} (Hover to see neighbors!)`; // Updated title
    }
    
    let shapes: any[] = [];
    let frame: PlotFrame | null = null;
    if (isAnimating && plotFrames.length > 0) {
      frame = plotFrames[currentFrame];
    }

    // Draw the Epsilon radius circle during animation
    if (scaler && frame && frame.checking_point !== null) {
      const point_index = frame.checking_point;
      const center_x = plotData.points[point_index][0];
      const center_y = plotData.points[point_index][1];
      const radius_x = epsilon * scaler.scale[0];
      const radius_y = epsilon * scaler.scale[1];
      const isCore = frame.labels[point_index] === STATUS_CORE;
      const color = isCore ? "rgba(0, 255, 0, 0.2)" : "rgba(255, 0, 0, 0.2)";
      const lineColor = isCore ? "green" : "red";

      shapes.push({
        type: 'circle',
        xref: 'x', yref: 'y',
        x0: center_x - radius_x,
        y0: center_y - radius_y,
        x1: center_x + radius_x,
        y1: center_y + radius_y,
        fillcolor: color,
        line: { color: lineColor, width: 2 }
      });
    }

    // Add hover lines IF we are NOT animating
    if (!isAnimating && hoverLines.length > 0) {
      shapes = [...shapes, ...hoverLines];
    }

    // --- UPDATED LAYOUT FOR LIGHT PLOTS ---
    return {
      autosize: true,
      title: { text: titleText, font: { color: '#000000' } }, // Black text
      margin: {l: 50, r: 40, t: 50, b: 50},
      // --- FIX: Applying your exact fix for axis titles ---
      xaxis: {
        title: {
          text: plotData.features?.[0] || 'X',
        },
        color: '#000000',
        gridcolor: '#eeeeee',
      },
      yaxis: {
        title: {
          text: plotData.features?.[1] || 'Y',
        },
        color: '#000000',
        gridcolor: '#eeeeee',
      },
      shapes: shapes,
      hovermode: 'closest', // Important for hover to work well
      transition: { duration: 0 }, // Disable transition for hover to feel instant
      showlegend: !isAnimating, // Show legend always unless animating
      legend: { traceorder: 'reversed', font: { color: '#000000' } }, // Black text
      paper_bgcolor: '#ffffff', // White background
      plot_bgcolor: '#ffffff',  // White background
    };
    // --- END UPDATED LAYAYOUT ---
  }

  // --- Helper to get score color ---
  const getScoreColor = (score: number | null) => {
    // Updated: This score is now [-1, 1] for some metrics
    if (score === null) return 'text-gray-800';
    if (score > 0.7) return 'text-green-600'; // Very good
    if (score > 0.3) return 'text-yellow-600'; // Mediocre
    if (score > -0.1) return 'text-red-600'; // Poor
    return 'text-red-800'; // Very poor (e.g. -1)
  }

  // --- Helper layout for all other plots ---
  const getSubPlotLayout = (title: string) => ({
    title: { text: title, font: { color: '#000000' } },
    autosize: true,
    margin: { t: 60, b: 40, l: 50, r: 20 }, // Adjusted margins
    // --- FIX: Applying your exact fix for axis titles ---
    xaxis: {
      title: {
        text: plotData.features?.[0] || 'X',
      },
      color: '#000000',
      gridcolor: '#eeeeee',
    },
    yaxis: {
      title: {
        text: plotData.features?.[1] || 'Y',
      },
      color: '#000000',
      gridcolor: '#eeeeee',
    },
    showlegend: true,
    legend: { traceorder: 'reversed', font: { color: '#000000' } },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
  });


  return (
    // Main container (DARK MODE)
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-900">

      {/* === SIDEBAR (DARK MODE) === */}
      {/* UPDATED: Width changed from md:w-80 to md:w-64 */}
      <aside className="w-full md:w-64 bg-gray-800 p-6 border-r border-gray-700 flex-shrink-0">
        <h1 className="text-2xl font-bold mb-6 text-blue-400 flex items-center">
          🔬 DBSCAN Visualizer
        </h1>

        {/* 1. Dataset Select */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2 text-gray-200">
            1. Choose Analogy
          </label>
          {/* FIX: Added suppressHydrationWarning={true}
            This error is often caused by browser extensions (like password managers) 
            adding extra attributes to the HTML, which confuses React. 
            This tells React to ignore those minor mismatches.
          */}
          <select
            suppressHydrationWarning={true} 
            className="w-full p-2 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-700 text-white"
            value={datasetChoice}
            onChange={(e) => setDatasetChoice(e.target.value)}
            disabled={isAnimating || isSearching}
          >
            <option>Civil: Pothole Hotspots</option>
            {/* --- UPDATED: Replaced Bio-Chem with Retail --- */}
            <option>Retail: Customer Store Zones</option>
            <option>Sports: Shot Chart Hotspots</option>
            {/* --- NEW: Added 4th dataset --- */}
            <option>Astro: Deep Space Signals</option>
          </select>
        </div>

        <hr className="my-6 border-gray-600"/>

        {/* 2. Epsilon Slider */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2 text-gray-200">
            2. Search Radius (ε): <span className="text-blue-300 bg-blue-900 px-2 py-1 rounded">{epsilon.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0.1" max="1.5" step="0.05"
            value={epsilon}
            onChange={(e) => setEpsilon(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            disabled={isAnimating || isSearching}
          />
          <p className="text-xs text-gray-400 mt-1">How far to look for neighbors?</p>
        </div>

        {/* 3. MinPts Slider */}
        <div className="mb-8">
          <label className="block text-sm font-bold mb-2 text-gray-200">
            3. Min Crowd Size: <span className="text-blue-300 bg-blue-900 px-2 py-1 rounded">{minPts}</span>
          </label>
          <input
            type="range"
            min="2"
            max="10"
            step="1"
            value={minPts}
            onChange={(e) => setMinPts(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            disabled={isAnimating || isSearching}
          />
          <p className="text-xs text-gray-400 mt-1">Points needed to form a cluster.</p>
        </div>

        {/* Run Button */}
        <button 
          className={`w-full text-white font-bold py-3 px-4 rounded-md shadow-md transition-all active:scale-95 ${
            isAnimating 
            ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700' 
            : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
          } ${isSearching ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleRunAnimation}
          disabled={isSearching}
        >
          {isAnimating ? '■ Stop Animation' : '▶ Run Animation'}
        </button>
      </aside>

      {/* === MAIN CONTENT (DARK MODE) === */}
      <main className="flex-1 p-6 md:p-10 overflow-auto">
        {/* Max width increased to 7xl to accommodate new layout */}
        <div className="max-w-7xl mx-auto"> 
            <h2 className="text-3xl font-bold mb-2 text-gray-100">
            {datasetChoice.split(":")[0]} Demo
            </h2>
            <p className="text-gray-400 mb-8">
            Adjust the sliders on the left, then press "Run Animation" to see the algorithm work.
            </p>

            {/* --- Top Grid (Analogy + Main Plot) --- */}
            {/* UPDATED: Grid changed from md:grid-cols-2 to lg:grid-cols-3 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              
              {/* --- Analogy Section (DARK MODE) --- */}
              {/* UPDATED: Added lg:col-span-1 */}
              <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 lg:col-span-1">
                <h3 className="text-xl font-bold text-gray-100 mb-4">The Analogy Explained</h3>
                <div className="space-y-4 text-gray-300">
                  <p><strong className="text-blue-400">The Problem:</strong> {analogy.problem}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p><strong className="text-gray-100">Search Radius (ε):</strong> {analogy.epsilon}</p>
                    <p><strong className="text-gray-100">Min Crowd Size:</strong> {analogy.minPts}</p>
                  </div>
                  <h4 className="font-bold pt-2 text-gray-100">Interpreting the Points:</h4>
                  <ul className="list-disc list-outside pl-5 space-y-2">
                    <li dangerouslySetInnerHTML={{ __html: analogy.core }} />
                    <li dangerouslySetInnerHTML={{ __html: analogy.border }} />
                    <li dangerouslySetInnerHTML={{ __html: analogy.noise }} />
                  </ul>
                </div>
              </div>
              
              {/* === CHART CONTAINER (NOW WHITE) === */}
              {/* UPDATED: Added lg:col-span-2 */}
              <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 lg:col-span-2" style={{ minHeight: '500px' }}>
                {isClient ? (
                  <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Chart...</div>}>
                    <Plot
                        data={getPlotlyData()}
                        layout={getPlotlyLayout() as any}
                        useResizeHandler={true}
                        style={{width: "100%", height: "100%"}}
                        onHover={handlePlotHover}
                        onUnhover={handlePlotHover} // Use same handler for unhover (it detects empty eventData)
                        config={{staticPlot: isAnimating, responsive: true}}
                    />
                  </Suspense>
                ) : (
                  <div className="flex items-center justify-center h-full">Loading Chart...</div>
                )}
              </div>
            </div>
            {/* --- END: Top Grid --- */}


            {/* --- Metrics Section (DARK MODE) --- */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 mb-8">
              <h3 className="text-xl font-bold text-gray-100 mb-4">Results & Metrics (From Manual Run)</h3>
              {/* Show results only after animation is done */}
              {finalLabels ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                      <span className="font-bold text-gray-200">Clusters Found:</span>
                      <span className="text-2xl font-bold text-blue-400">
                        {Math.max(...finalLabels) > 0 ? Math.max(...finalLabels) : 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                      <span className="font-bold text-gray-200">Noise Points:</span>
                      <span className="text-2xl font-bold text-white">
                        {finalLabels.filter(l => l === STATUS_NOISE).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                      <span className="font-bold text-gray-200">Happiness Score (Silhouette):</span>
                      <span className={`text-2xl font-bold ${getScoreColor(silhouetteScore)}`}>
                        {silhouetteScore === null ? 'N/A' : silhouetteScore.toFixed(2)}
                      </span>
                    </div>
                    
                    {/* --- UPDATED: Changed from "Bio-Chem" to "Retail" --- */}
                    {datasetChoice === "Retail: Customer Store Zones" && silhouetteScore !== null && (
                      <div className="p-3 bg-yellow-200 border-l-4 border-yellow-500 text-yellow-900 rounded-md">
                        <strong className="font-bold">Note:</strong> The Silhouette score struggles with rings. The "Best Parameters" section uses a better score.
                      </div>
                    )}
                    {/* --- NEW: Note for Astro dataset --- */}
                    {datasetChoice === "Astro: Deep Space Signals" && finalLabels.filter(l => l > 0).length === 0 && (
                      <div className="p-3 bg-green-200 border-l-4 border-green-500 text-green-900 rounded-md">
                        <strong className="font-bold">Correct Result!</strong> A 'null' score and 0 clusters is the right answer for this noisy data.
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="text-center text-gray-400 pt-10">
                    <p>Run the animation to see the results and happiness score.</p>
                  </div>
                )}
            </div>
            {/* --- END: Metrics Section --- */}

            {/* --- "HOW TO FIND" SECTION (DARK MODE) --- */}
            <h2 className="text-3xl font-bold mb-4 text-gray-100 mt-16">
              How to Find the 'Best' Parameters?
            </h2>
            <div className="bg-blue-900 text-blue-100 p-6 rounded-xl shadow-lg mb-8 border border-blue-700">
              <p className="mb-2">
                We use a <strong className="text-white">dataset-aware scoring system</strong>. A "blob" dataset uses Silhouette, but a "ring" dataset needs a special score that measures ring separation, and a "noise" dataset needs a score that rewards finding 0 clusters.
              </p>
              <p>
                <strong className="text-white">Goal for this dataset:</strong> {scoreExplanation}
              </p>
            </div>
            {/* --- END: "HOW TO FIND" SECTION --- */}

            {/* --- NEW K-MEANS vs DBSCAN Section --- */}
            {/* --- UPDATED: Changed from "Bio-Chem" to "Retail" --- */}
            {isClient && datasetChoice === "Retail: Customer Store Zones" && kMeansPlotTraces.length > 0 && bestPlotTraces.length > 0 && (
              <>
                {/* --- UPDATED: New Title --- */}
                <h2 className="text-3xl font-bold mb-4 text-gray-100 mt-16">
                  DBSCAN vs. K-Means: The "Circles" Test
                </h2>
                {/* --- UPDATED: New Explanation --- */}
                <p className="text-gray-400 mb-8">
                  This is *why* DBSCAN is so powerful. This dataset has non-spherical clusters. Watch how K-Means (which *assumes* clusters are round blobs) fails, while DBSCAN (which finds *density*) figures it out perfectly.
                </p>

                {/* --- Toggle Button --- */}
                <div className="mb-4">
                  <button
                    onClick={() => setIsExplanationOpen(!isExplanationOpen)}
                    className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-all"
                  >
                    {isExplanationOpen ? '▼ Hide Detailed Explanation' : '▶ Show Detailed Explanation'}
                  </button>
                </div>

                {/* --- Conditionally Rendered Explanation Box --- */}
                {/* --- UPDATED: New Analogy --- */}
                {isExplanationOpen && (
                  <div className="bg-gray-700 p-6 rounded-lg mb-6 border border-gray-600">
                    <h4 className="font-bold text-lg text-white mb-3">Why DBSCAN Wins (A Simple Analogy)</h4>
                    <p className="text-gray-300 mb-4">
                      Think of the two plots like this:
                    </p>
                    
                    <strong className="text-blue-300">1. The K-Means Plot (Left):</strong>
                    <p className="text-gray-300 ml-4 mb-4">
                      This is like trying to find the "average" customer location for the 'inner ring' and the "average" for the 'outer ring'. The average of a ring is a point in the *middle* where no one is! K-Means just draws a line and splits both rings in half. It completely fails.
                    </p>

                    <strong className="text-blue-300">2. The DBSCAN Plot (Right):</strong>
                    <p className="text-gray-300 ml-4 mb-4">
                      DBSCAN works like "connect-the-dots." It doesn't look for averages. It starts at one customer and just looks for *immediate neighbors* (within the "Search Radius"). It follows this chain of neighbors, like following a trail.
                      <br /> <br />
                      This allows it to "walk" along the entire outer ring, and "walk" along the entire inner ring. It correctly sees they are two *separate, dense trails*.
                    </p>

                    <strong className="text-blue-300">The Bonus: Noise Detection</strong>
                    <p className="text-gray-300 ml-4">
                      DBSCAN also sees the black 'x' shoppers, realizes they are 'outliers' far from any zone, and correctly calls them "Noise." K-Means can't do this; it forces every single point to be in a cluster, even when it doesn't make sense.
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                  {/* K-Means Plot */}
                  <div className="w-full h-80 bg-white rounded-lg p-2">
                    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Chart...</div>}>
                      <Plot
                        data={kMeansPlotTraces}
                        layout={getSubPlotLayout("K-Means Result (K=2)") as any}
                        useResizeHandler={true}
                        style={{width: "100%", height: "100%"}}
                        config={{responsive: true}}
                      />
                    </Suspense>
                  </div>
                  {/* DBSCAN Plot */}
                  <div className="w-full h-80 bg-white rounded-lg p-2">
                    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Chart...</div>}>
                      <Plot
                        data={bestPlotTraces}
                        layout={getSubPlotLayout("DBSCAN Result (Best Params)") as any}
                        useResizeHandler={true}
                        style={{width: "100%", height: "100%"}}
                        config={{responsive: true}}
                      />
                    </Suspense>
                  </div>
                </div>
              </>
            )}
            {/* --- END K-MEANS vs DBSCAN Section --- */}


            {/* --- BEST PARAMETER SECTION (DARK MODE) --- */}
            <h2 className="text-3xl font-bold mb-4 text-gray-100 mt-16">
              🏆 Best Parameters Found
            </h2>
            {/* --- FIX: Corrected closing </p> tag --- */}
            <p className="text-gray-400 mb-8">
              We tested a dataset-specific grid of parameter combinations to find the highest scoring result.
            </p>
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
              {isSearching ? (
                <div className="text-center text-gray-400 py-20">
                  <p>Searching for the best parameters and grid plots...</p>
                </div>
              ) : bestParams ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {/* Left side: Metrics */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                      <span className="font-bold text-gray-200">Best Search Radius (ε):</span>
                      <span className="text-2xl font-bold text-blue-400">
                        {bestParams.eps.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                      <span className="font-bold text-gray-200">Best Min Crowd Size:</span>
                      <span className="text-2xl font-bold text-blue-400">
                        {bestParams.minPts}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                      <span className="font-bold text-gray-200">Best Happiness Score:</span>
                      <span className={`text-2xl font-bold ${getScoreColor(bestParams.score)}`}>
                        {bestParams.score.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {/* Right side: Plot (Larger) */}
                  <div className="w-full h-96 bg-white rounded-lg p-2 md:col-span-2">
                    {isClient ? (
                      <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Chart...</div>}>
                        <Plot
                          data={bestPlotTraces}
                          layout={getSubPlotLayout("Best Clustering Result") as any}
                          useResizeHandler={true}
                          style={{width: "100%", height: "100%"}}
                          config={{responsive: true}}
                        />
                      </Suspense>
                    ) : (
                      <div className="flex items-center justify-center h-full">Loading Chart...</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-20">
                  <p>Could not find a valid set of parameters (no clusters were found).</p>
                </div>
              )}
            </div>
            
            {/* --- 2x2 GRID SECTION (DARK MODE) --- */}
            <h2 className="text-3xl font-bold mb-4 text-gray-100 mt-16">
              Why Parameters Matter: A 2x2 Grid
            </h2>
            <p className="text-gray-400 mb-8">
              See how changing `Search Radius` and `Min Crowd Size` dramatically changes the results. This grid shows four common scenarios to help you understand what the parameters do.
            </p>
            
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
              {isSearching ? (
                <div className="text-center text-gray-400 py-20">
                  <p>Generating grid plots...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {gridPlots.map((plot, index) => (
                    <div key={index} className="w-full h-80 bg-white rounded-lg p-2">
                      {isClient ? (
                        // --- FIX: Corrected Suspense typo ---
                        <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Chart...</div>}>
                          <Plot
                            data={plot.traces}
                            layout={getSubPlotLayout(plot.title) as any}
                            useResizeHandler={true}
                            style={{width: "100%", height: "100%"}}
                            config={{responsive: true}}
                          />
                        </Suspense>
                      ) : (
                        <div className="flex items-center justify-center h-full">Loading Chart...</div>
                    )}
                    </div>
                  ))}
                </div>
              )}
            </div>

        </div>
      </main>
    </div>
  );
}