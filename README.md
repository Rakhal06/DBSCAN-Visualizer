🔬 Interactive DBSCAN Clustering Visualizer

This is a React (Next.js) application designed to teach the fundamentals of the DBSCAN (Density-Based Spatial Clustering of Applications with Noise) algorithm in a highly visual and interactive way.

Instead of focusing on abstract math, this tool uses real-world analogies (like "Pothole Hotspots" or "Player Shot Charts") to make the core concepts of epsilon (Search Radius) and MinPts (Minimum Crowd Size) intuitive for a non-technical audience.

Live Project Link: [INSERT YOUR LIVE DEPLOYMENT LINK HERE, e.g., Vercel or Netlify]

📸 Screenshots

Here is the main user interface, showing the "Pothole Hotspots" analogy. Users can adjust the algorithm parameters on the left and see the raw data on the right.

![Main UI showing the sidebar with parameters and the main plot with raw, unclustered data.]([<img width="1895" height="981" alt="UI" src="https://github.com/user-attachments/assets/7fb928a4-56b2-48c3-a4cd-7b5145d3189c" />
])

Key Features in Action

1. Step-by-Step Animation
Users can press "Run Animation" to see the algorithm work in real-time. It shows the algorithm checking each point, identifying Core points (green circle), and expanding clusters.

![Animation in progress, showing a green circle around a 'Core' point and a red circle around a point being 'Checked'.]([<img width="1016" height="832" alt="animation1" src="https://github.com/user-attachments/assets/1815ba1d-cbe0-4a1a-893e-e9ecdd461669" />
<img width="1001" height="847" alt="animation2" src="https://github.com/user-attachments/assets/0cc223e3-b6ef-43d9-acd5-67d25c39a18c" />
])

2. Interactive Hover Inspection
To make the "Search Radius (ε)" concept tangible, users can hover over any point (when not animating) to instantly see all other points within its search radius, connected by red dotted lines.

![Hover feature showing dotted red lines connecting a central point to all of its neighbors.]([<img width="327" height="225" alt="hover" src="https://github.com/user-attachments/assets/e13a33c3-15e1-4986-98c7-b62104aa0179" />
])

3. Final Results & "Happiness Score"
After the animation, the app shows the final clusters, metrics, and a "Happiness Score" (Silhouette Score) to help the user judge the quality of their chosen parameters.

![The final clustered plot, showing distinct colored clusters (blue, orange) and noise points (black 'x'). The 'Results & Metrics' card is also visible.]([<img width="965" height="797" alt="image" src="https://github.com/user-attachments/assets/f9f17b15-4c59-4b3d-a7f3-b3ca0b1c5a01" />
])

4. Parameter Search & Comparison
The app automatically runs 30 parameter combinations in the background to find the "Best Parameters" for the current dataset. It also provides a 2x2 grid to show why parameters matter, comparing high/low settings.

![The "Best Parameters Found" and "Why Parameters Matter" sections, showing the 2x2 grid of plots.]([<img width="1523" height="700" alt="image" src="https://github.com/user-attachments/assets/be8c2ad4-ec45-4eaf-b608-95aefdf668bb" />
])

✨ Core Features

Step-by-Step Visualization: Watch the DBSCAN algorithm build clusters one point at a time.

Interactive Radius-on-Hover: Hover on any point to see its neighbors based on the current epsilon setting.

Live Parameter Tuning: Use sliders to adjust epsilon (Search Radius) and MinPts (Min Crowd Size) and immediately see the effect.

DBSCAN vs. K-Means Showdown: A special "Concentric Circles" dataset demonstrates exactly why density-based clustering (DBSCAN) is superior to centroid-based clustering (K-Means) for complex, non-spherical shapes.

Four Unique Datasets: Explore different clustering challenges:

Civil: Finding "blob-like" Pothole Hotspots.

Retail: Identifying "ring-shaped" Customer Store Zones.

Sports: Locating sparse Shot Chart Hotspots.

Astro: Sifting "noise-heavy" Deep Space Signals.

Advanced Dataset-Aware Scoring: The "Best Parameter" search is powered by a smart scoring system that changes based on the data's expected shape:

retailDensityScore: A custom score that rewards finding two distinct rings.

astroScore: A special score that rewards finding zero clusters, (the correct answer for the noise dataset).

Silhouette Score & DBCV: Used as intelligent fallbacks for blob-like data.

2x2 Comparison Grid: A powerful teaching tool that shows the results for four common parameter scenarios (e.g., "High Radius, Low Crowd" vs. "Low Radius, High Crowd").

🛠️ Tech Stack

Framework: React / Next.js

Language: TypeScript

Plotting: Plotly.js (react-plotly.js)

Styling: Tailwind CSS

Client-Side Rendering: Uses React.lazy and Suspense to ensure the Plotly.js library only runs in the browser.

🚀 How to Run Locally

Clone the repository:

git clone [YOUR GITHUB REPO URL]
cd [YOUR REPO NAME]


Install dependencies:

npm install
# or
yarn install


Run the development server:

npm run dev
# or
yarn dev


Open http://localhost:3000 in your browser to see the application.
