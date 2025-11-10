"use client";
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react'; // Added Suspense and lazy
// import dynamic from 'next/dynamic'; // Removed this line
// import Plot from 'react-plotly.js'; // Removed this line
import { PlotRelayoutEvent } from 'plotly.js';

// Load Plotly only on the client side
// const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }); // Removed this line
const Plot = lazy(() => import('react-plotly.js')); // Use React.lazy

// --- CONSTANTS for Algorithm Status ---
const STATUS_UNVISITED = 0;
const STATUS_NOISE = -1;
const STATUS_CHECKING = -2; // Custom status for visualization
const STATUS_CORE = -3;     // Custom status for visualization
const CLUSTER_COLORS = [ // Colors for clusters 1, 2, 3...
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
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
 * JS replacement for make_moons
 */
function generateMoons(n_samples: number, noise: number): number[][] {
  const points: number[][] = [];
  const n_samples_per_moon = Math.floor(n_samples / 2);

  // First moon
  for (let i = 0; i < n_samples_per_moon; i++) {
    const angle = Math.random() * Math.PI;
    points.push([
      Math.cos(angle) + noise * randomNormal(),
      Math.sin(angle) + noise * randomNormal()
    ]);
  }
  // Second moon
  for (let i = 0; i < n_samples_per_moon; i++) {
    const angle = Math.random() * Math.PI;
    points.push([
      1 - Math.cos(angle) + noise * randomNormal(),
      0.5 - Math.sin(angle) + noise * randomNormal()
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
  features: string[];
}

function getDataset(datasetName: string): Dataset {
  if (datasetName === "Civil: Pothole Hotspots") {
    const centers = [[2, 2], [7, 8]];
    let X = generateBlobs(20, centers, 0.7);
    let X_noise = generateNoise(6, [0, 0], [15, 15]);
    return {
      points: [...X, ...X_noise],
      features: ['Longitude', 'Latitude']
    };
  }
  else if (datasetName === "Bio-Chem: Molecule Families") {
    let X = generateMoons(50, 0.1);
    let X_noise = generateNoise(5, [-2, -2], [3, 3]);
    return {
      points: [...X, ...X_noise],
      features: ['Molecular Weight', 'LogP']
    };
  }
  else if (datasetName === "Sports: Shot Chart Hotspots") {
    const centers = [[0, 5], [-20, 15]];
    let X = generateBlobs(20, centers, 1.2);
    let X_noise = generateNoise(7, [-30, 0], [30, 30]);
    return {
      points: [...X, ...X_noise],
      features: ['X Coordinate', 'Y Coordinate']
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
    case "Bio-Chem: Molecule Families":
      return {
        problem: "We have molecules plotted by their properties. We need to find 'families' of molecules that behave similarly.",
        epsilon: "This is the 'property similarity' radius. How similar molecules must be to be neighbors.",
        minPts: "This is the 'family size' rule. How many similar molecules are needed to form a core group.",
        core: "An *Archetype Molecule* (●). This is a perfect example of its family, with many similar molecules nearby.",
        border: "A *'Cousin' Molecule* (■). It's related to the family, but on the edge of the group's properties.",
        noise: "A *Unique Molecule* (X). Its properties are very different. This could be a mistake, or a new discovery!"
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
    default:
      return { problem: "", epsilon: "", minPts: "", core: "", border: "", noise: "" };
  }
}

// Get score explanation
function getScoreExplanation(datasetName: string): string {
  switch (datasetName) {
    case "Civil: Pothole Hotspots":
      return "A high score means we've clearly identified separate pothole hotspots.";
    case "Bio-Chem: Molecule Families":
      return "A high score means we've found distinct molecule families (but this score struggles with curves!).";
    case "Sports: Shot Chart Hotspots":
      return "A high score means we've found well-defined shooting 'hotspots'.";
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


// --- SILHOUETTE SCORE (HAPPINESS SCORE) ---

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


// --- BEST PARAMETER FINDER ---
interface BestParamData {
  eps: number;
  minPts: number;
  score: number;
  labels: number[];
}

function findBestParameters(X_scaled: number[][]): BestParamData | null {
  // Increased search space
  const eps_range = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2];
  const min_pts_range = [3, 4, 5, 6, 7];
  
  let bestScore = -1;
  let bestParams: BestParamData | null = null;

  for (const eps of eps_range) {
    for (const minPts of min_pts_range) {
      const labels = runDBSCAN_direct(X_scaled, eps, minPts);
      const score = calculateSilhouetteScore(X_scaled, labels);

      if (score && score > bestScore) {
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
  const [silhouetteScore, setSilhouetteScore] = useState<number | null>(null);

  // --- BEST PARAM STATE ---
  const [isSearching, setIsSearching] = useState(false);
  const [bestParams, setBestParams] = useState<BestParamData | null>(null);
  const [bestPlotTraces, setBestPlotTraces] = useState<any[]>([]);

  // --- 2x2 GRID STATE ---
  const [gridPlots, setGridPlots] = useState<GridPlotData[]>([]);

  // --- HOVER STATE ---
  const [hoverLines, setHoverLines] = useState<any[]>([]);

  // --- NEW CLIENT-SIDE STATE ---
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
    
    const newData = getDataset(datasetChoice);
    setPlotData(newData);
    
    const newScaler = new StandardScaler();
    newScaler.fit(newData.points);
    setScaler(newScaler);
  }, [datasetChoice]);

  // --- NEW EFFECT TO CHECK FOR CLIENT ---
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
  }, [isAnimating, plotFrames]);

  // --- EFFECT for BEST PARAM & GRID SEARCH ---
  useEffect(() => {
    if (!scaler) return; // Wait for scaler to be set

    setIsSearching(true);
    setBestParams(null);
    setBestPlotTraces([]);
    setGridPlots([]); // Clear grid plots

    // Run search in a timeout to let UI update (show loading)
    setTimeout(() => {
      const X_scaled = scaler.transform(plotData.points);
      
      // 1. Find Best
      const best = findBestParameters(X_scaled);
      setBestParams(best);

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
        const score = calculateSilhouetteScore(X_scaled, labels);
        const n_clusters = Math.max(...labels) > 0 ? Math.max(...labels) : 0;
        const n_noise = labels.filter(l => l === STATUS_NOISE).length;
        
        const scoreStr = score !== null ? `Happiness: ${score.toFixed(2)}` : 'Happiness: N/A';
        const titleText = `<b>${params.titlePrefix}</b><br><sup>${n_clusters} clusters, ${n_noise} noise | ${scoreStr}</sup>`;
        
        return { traces, title: titleText }; // Return new dynamic title text
      });
      
      setGridPlots(newGridPlots);
      setIsSearching(false);
    }, 100); // 100ms delay

  }, [scaler]); // Re-run when scaler (i.e., dataset) changes

  // --- EFFECT to create BEST PLOT traces (with shapes) ---
  useEffect(() => {
    if (!bestParams || !scaler) {
      setBestPlotTraces([]);
      return;
    }

    const X_scaled = scaler.transform(plotData.points);
    const pointTypes = calculatePointTypes(X_scaled, bestParams.labels, bestParams.eps, bestParams.minPts);
    const traces = createPlotlyTraces(plotData.points, bestParams.labels, pointTypes); // Use helper
    setBestPlotTraces(traces);

  }, [bestParams, scaler, plotData.points]);


  // --- ANIMATION HANDLERS ---
  const stopAnimation = (calculateFinal: boolean) => {
    setIsAnimating(false);
    
    if (calculateFinal && plotFrames.length > 0 && scaler) {
      const lastFrame = plotFrames[plotFrames.length - 1];
      const X_scaled = scaler.transform(plotData.points);
      const types = calculatePointTypes(X_scaled, lastFrame.labels, epsilon, minPts);
      const score = calculateSilhouetteScore(X_scaled, lastFrame.labels);
      
      setFinalLabels(lastFrame.labels);
      setPointTypes(types);
      setSilhouetteScore(score);
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

    // Ensure pointIndex is valid
    const point = eventData.points[0];
    if (point.pointIndex === undefined || point.pointIndex === null) {
        if (hoverLines.length > 0) {
            setHoverLines([]); // Clear lines if invalid point
        }
        return;
    }
    const pointIndex = point.pointIndex;


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
      const color = (label === STATUS_NOISE) ? 'rgb(0, 0, 0)' : CLUSTER_COLORS[(label - 1) % CLUSTER_COLORS.length];
      
      let key = "";
      let symbol = "circle";
      let size = 10;

      if (pointTypes) {
        // --- Detailed key for Main Plot and Best Plot ---
        const type = pointTypes[i];
        symbol = (type === 'Noise') ? 'x' : (type === 'Border') ? 'square' : 'circle';
        size = (type === 'Noise') ? 8 : 10;
        key = label === STATUS_NOISE ? "Noise" : `Cluster ${label} - ${type}`;
      } else {
        // --- Simple key for 2x2 Grid ---
        symbol = (label === STATUS_NOISE) ? 'x' : 'circle';
        size = (label === STATUS_NOISE) ? 8 : 10;
        key = label === STATUS_NOISE ? "Noise" : `Cluster ${label}`;
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
      xaxis: { title: plotData.features[0], color: '#000000', gridcolor: '#eeeeee' }, // Black text, light grid
      yaxis: { title: plotData.features[1], color: '#000000', gridcolor: '#eeeeee' }, // Black text, light grid
      shapes: shapes,
      hovermode: 'closest', // Important for hover to work well
      transition: { duration: 0 }, // Disable transition for hover to feel instant
      showlegend: !isAnimating, // Show legend always unless animating
      legend: { traceorder: 'reversed', font: { color: '#000000' } }, // Black text
      paper_bgcolor: '#ffffff', // White background
      plot_bgcolor: '#ffffff',  // White background
    };
    // --- END UPDATED LAYOUT ---
  }

  // --- Helper to get score color ---
  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-800';
    if (score > 0.7) return 'text-green-600';
    if (score > 0.3) return 'text-yellow-600';
    return 'text-red-600';
  }

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
          <select
            className="w-full p-2 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-700 text-white"
            value={datasetChoice}
            onChange={(e) => setDatasetChoice(e.target.value)}
            disabled={isAnimating || isSearching}
          >
            <option>Civil: Pothole Hotspots</option>
            <option>Bio-Chem: Molecule Families</option>
            <option>Sports: Shot Chart Hotspots</option>
          </select>
        </div>

        <hr className="my-6 border-gray-600"/>

        {/* 2. Epsilon Slider */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2 text-gray-200">
            2. Search Radius (ε): <span className="text-blue-300 bg-blue-900 px-2 py-1 rounded">{epsilon}</span>
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
              <h3 className="text-xl font-bold text-gray-100 mb-4">Results & Metrics</h3>
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
                      <span className="font-bold text-gray-200">Happiness Score:</span>
                      <span className={`text-2xl font-bold ${getScoreColor(silhouetteScore)}`}>
                        {silhouetteScore === null ? 'N/A' : silhouetteScore.toFixed(2)}
                      </span>
                    </div>
                    
                    {datasetChoice === "Bio-Chem: Molecule Families" && silhouetteScore !== null && (
                      <div className="p-3 bg-yellow-200 border-l-4 border-yellow-500 text-yellow-900 rounded-md">
                        <strong className="font-bold">Note:</strong> This 'Happiness Score' is low because it struggles with curved shapes. Trust your eyes!
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
                We use a <strong className="text-white">Cluster Happiness Score</strong> (or Silhouette Score) from -1 to +1. A high score (near +1) means points are happy and fit well in their cluster.
              </p>
              <p>
                <strong className="text-white">Goal for this dataset:</strong> {scoreExplanation}
              </p>
            </div>
            {/* --- END: "HOW TO FIND" SECTION --- */}


            {/* --- BEST PARAMETER SECTION (DARK MODE) --- */}
            <h2 className="text-3xl font-bold mb-4 text-gray-100 mt-16">
              🏆 Best Parameters Found
            </h2>
            <p className="text-gray-400 mb-8">
              We tested 30 combinations of parameters in the background to find the one with the highest "Happiness Score" for this dataset.
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
                          layout={{
                        margin: { t: 40, b: 20, l: 20, r: 20 },
                        xaxis: { title: plotData.features[0], color: '#000000', gridcolor: '#eeeeee' },
                        yaxis: { title: plotData.features[1], color: '#000000', gridcolor: '#eeeeee' },
                          }}
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
                        <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Chart...</div>}>
                          <Plot
                            data={plot.traces}
                            layout={{
                          margin: { t: 60, b: 20, l: 20, r: 20 }, // Increased top margin
                          xaxis: { title: plotData.features[0], color: '#000000', gridcolor: '#eeeeee' },
                          yaxis: { title: plotData.features[1], color: '#000000', gridcolor: '#eeeeee' },
                            }}
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