import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import time
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.datasets import make_blobs, make_moons
from sklearn.metrics import silhouette_score # <-- NEW IMPORT

# --- Page Configuration ---
st.set_page_config(
    page_title="DBSCAN Interactive Explainer",
    page_icon="🔬",
    layout="wide"
)

# --- NEW: Global Animation Statuses ---
# Define status codes for visualization globally
STATUS_UNVISITED = 0
STATUS_NOISE = -1
STATUS_CHECKING = -2
STATUS_CORE = -3
# --- End New ---


# --- Data Generation ---
# We generate synthetic data to make this app self-contained.
def get_data(dataset_name):
    """Generates a synthetic dataset based on the chosen analogy."""
    
    if dataset_name == "Civil: Pothole Hotspots":
        # 2 dense clusters (hotspots) + 6 random noise points (isolated potholes)
        centers = [(2, 2), (7, 8)]
        X, y = make_blobs(n_samples=20, centers=centers, cluster_std=0.7, random_state=42) # Reduced to 20
        X_noise = np.random.rand(6, 2) * 15 # Reduced to 6
        X = np.concatenate([X, X_noise])
        df = pd.DataFrame(X, columns=['Longitude', 'Latitude'])
        features = ['Longitude', 'Latitude']
        return df, features

    elif dataset_name == "Bio-Chem: Molecule Families":
        # Two non-linear 'moons' (families) + 5 random noise points (unique molecules)
        # Reverting to two moons as per user request
        X, y = make_moons(n_samples=50, noise=0.1, random_state=42) # Generate two moons, 50 points total
        X_noise = (np.random.rand(5, 2) - 0.5) * 4 # Kept at 5
        X = np.concatenate([X, X_noise])
        df = pd.DataFrame(X, columns=['Molecular Weight', 'LogP'])
        features = ['Molecular Weight', 'LogP']
        return df, features

    elif dataset_name == "CBI: Credit Fraud Rings":
        # One main blob (normal users) + 2 tiny, dense blobs (fraud rings)
        # Normal users
        X_normal, y_normal = make_blobs(n_samples=25, centers=[(5, 5)], cluster_std=1.5, random_state=42) # Reduced to 25
        # Fraud rings
        centers_fraud = [(2, 8), (8, 2)]
        X_fraud, y_fraud = make_blobs(n_samples=8, centers=centers_fraud, cluster_std=0.15, random_state=42) # Reduced to 8
        X = np.concatenate([X_normal, X_fraud])
        df = pd.DataFrame(X, columns=['Transaction Amount', 'Time of Day'])
        features = ['Transaction Amount', 'Time of Day']
        return df, features

    elif dataset_name == "Sports: Shot Chart Hotspots":
        # 2 dense clusters at common basketball shot locations + 7 noise points
        centers = [
            (0, 5),     # Under basket
            (-20, 15), # Left 3-pt wing
        ]
        X, y = make_blobs(n_samples=20, centers=centers, cluster_std=1.2, random_state=42) # Reduced to 20
        X_noise = (np.random.rand(7, 2) - 0.5) * 60 # Reduced to 7
        X_noise[:, 1] = np.abs(X_noise[:, 1]) # Keep shots on one half of court
        X = np.concatenate([X, X_noise])
        df = pd.DataFrame(X, columns=['X Coordinate', 'Y Coordinate'])
        features = ['X Coordinate', 'Y Coordinate']
        return df, features

# --- Sidebar Controls ---
st.sidebar.title("DBSCAN Controls")

dataset_choice = st.sidebar.selectbox(
    "1. Choose a Dataset Analogy:",
    [
        "Civil: Pothole Hotspots",
        "Bio-Chem: Molecule Families",
        "CBI: Credit Fraud Rings",
        "Sports: Shot Chart Hotspots"
    ]
)

st.sidebar.markdown("---")
st.sidebar.markdown("**Main Plot & Animation Controls**")

# Set default params. These work well with StandardScaler.
eps = st.sidebar.slider(
    "2. Epsilon (ε) - Neighborhood Radius",
    min_value=0.05, max_value=1.5, value=0.5, step=0.05
)

min_pts = st.sidebar.slider(
    "3. MinPts - Core Point Threshold",
    min_value=2, max_value=10, value=4, step=1 # Max value reduced to 10
)

st.sidebar.markdown("---")

# *** Animation speed slider ***
speed_options = {"Slow": 3.0, "Normal": 1.0, "Fast": 0.5}
speed_selection = st.sidebar.select_slider(
    "4. Animation Speed",
    options=["Slow", "Normal", "Fast"],
    value="Normal"
)
speed_multiplier = speed_options[speed_selection]


run_animation = st.sidebar.button("Run Step-by-Step Animation")
st.sidebar.info("The animation now runs on the *original* data. The 'epsilon' neighborhood is red when checking and green when a core point is found.")


# --- Animation Helper Functions ---

def get_neighbors(X_scaled, point_index, eps):
    """Find all points within eps distance of point_index"""
    # Calculate Euclidean distance from point_index to all other points
    distances = np.linalg.norm(X_scaled - X_scaled[point_index], axis=1)
    # Return indices of neighbors
    return np.where(distances < eps)[0]

def visual_dbscan(X_scaled, eps, min_pts):
    """
    A generator function that yields the state of the DBSCAN algorithm
    at each step for visualization.
    This version yields *inside* the cluster expansion loop for point-by-point growth.
    """
    n_points = X_scaled.shape[0]
    # Labels: 0 = unvisited, -1 = noise, 1, 2, ... = cluster_id
    labels = np.zeros(n_points, dtype=int)
    cluster_id = 0
    
    # Iterate over all points
    for i in range(n_points):
        if labels[i] != STATUS_UNVISITED:
            continue # Already visited
            
        # 1. Check point i
        labels[i] = STATUS_CHECKING
        neighbors = get_neighbors(X_scaled, i, eps)
        yield {
            "title": f"Checking Point {i}...",
            "labels": labels.copy(),
            "checking_point": i,
            "neighbors": neighbors,
            "epsilon_radius": eps
        }
        
        if len(neighbors) < min_pts:
            # 2. Mark as Noise
            labels[i] = STATUS_NOISE
            yield {
                "title": f"Point {i} is Noise (Neighbors < {min_pts})",
                "labels": labels.copy(),
                "checking_point": None
            }
        else:
            # 3. Found a Core Point, start new cluster
            cluster_id += 1
            labels[i] = cluster_id
            
            # Mark as Core for visualization
            temp_labels = labels.copy()
            temp_labels[i] = STATUS_CORE
            yield {
                "title": f"Point {i} is a Core Point! Starting Cluster {cluster_id}",
                "labels": temp_labels.copy(),
                "checking_point": i,
                "neighbors": neighbors,
                "epsilon_radius": eps
            }
            
            # 4. Expand the cluster using a queue (NOW YIELDING INSIDE)
            queue = list(neighbors)
            in_queue = set(neighbors)
            
            while queue:
                q_index = queue.pop(0)
                if q_index in in_queue:
                    in_queue.remove(q_index)
                
                point_updated = False # Flag to see if we should yield

                # If it was noise, it's now a border point
                if labels[q_index] == STATUS_NOISE:
                    labels[q_index] = cluster_id
                    point_updated = True

                # If it's unvisited
                if labels[q_index] == STATUS_UNVISITED:
                    labels[q_index] = cluster_id
                    point_updated = True
                    
                    # Check if this new point is ALSO a core point
                    q_neighbors = get_neighbors(X_scaled, q_index, eps)
                    if len(q_neighbors) >= min_pts:
                        # Add its neighbors to the queue
                        for n_index in q_neighbors:
                            if (labels[n_index] == STATUS_UNVISITED or labels[n_index] == STATUS_NOISE) and n_index not in in_queue:
                                queue.append(n_index)
                                in_queue.add(n_index)
                
                # 5. Yield the frame *inside* the loop if a point was added
                if point_updated:
                    yield {
                        "title": f"Expanding Cluster {cluster_id}... (Adding Point {q_index})",
                        "labels": labels.copy(),
                        "checking_point": None # No ellipse on this frame
                    }

    # Final state
    yield {
        "title": "Algorithm Complete!",
        "labels": labels.copy(),
        "checking_point": None
    }


# --- NEW: Helper function for Silhouette Score ---
@st.cache_data # Cache calculation for speed
def calculate_silhouette(X_scaled, labels):
    """
    Calculates the Silhouette Score.
    Returns None if the score cannot be computed.
    """
    try:
        # Need at least 2 clusters and less than n-1 clusters
        if len(set(labels)) <= 1 or len(set(labels)) >= len(X_scaled)-1:
            return None # Cannot calculate
        return silhouette_score(X_scaled, labels)
    except ValueError:
        return None

# --- UPDATED: Helper function for 2x2 Grid ---
@st.cache_data # Cache plots
def run_and_plot_grid(X_scaled, X_orig, features, eps, min_pts, title):
    """
    Runs DBSCAN with given params and returns a Plotly figure
    and the calculated Silhouette Score.
    """
    # Run DBSCAN
    db = DBSCAN(eps=eps, min_samples=min_pts).fit(X_scaled)
    labels = db.labels_
    
    # Get stats
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = list(labels).count(-1)
    
    # --- NEW: Calculate Silhouette Score ---
    score = calculate_silhouette(X_scaled, labels)
    score_str = f"Happiness: {score:.2f}" if score is not None else "Happiness: N/A"
    
    # Create a dataframe for plotting
    df_grid = pd.DataFrame(X_orig, columns=features)
    df_grid['Cluster'] = [str(l) for l in labels]
    
    # Create the plot
    fig = px.scatter(
        df_grid, 
        x=features[0], 
        y=features[1], 
        color='Cluster',
        color_discrete_sequence=px.colors.qualitative.Vivid,
        # --- UPDATED TITLE ---
        title=f"<b>{title}</b><br><sup>{n_clusters} clusters, {n_noise} noise | {score_str}</sup>"
    )
    fig.update_layout(
        height=300, 
        margin=dict(l=10, r=10, t=50, b=20), # Tight margins
        showlegend=False
    )
    # --- UPDATED RETURN ---
    return fig

# --- NEW: Function to find the best parameters ---
@st.cache_data # Cache this expensive computation
def find_best_parameters(_X_scaled, X_orig, features):
    """
    Runs DBSCAN over a range of parameters and finds the best
    one based on the Silhouette Score.
    """
    best_score = -1
    best_eps = 0
    best_min_pts = 0
    
    # Define a small search space to keep it fast
    eps_range = np.linspace(0.1, 1.5, 10)
    min_pts_range = [3, 4, 5, 6]
    
    scores = []
    
    for eps_val in eps_range:
        for min_pts_val in min_pts_range:
            db = DBSCAN(eps=eps_val, min_samples=min_pts_val).fit(_X_scaled)
            labels = db.labels_
            score = calculate_silhouette(_X_scaled, labels)
            
            if score is not None:
                scores.append((score, eps_val, min_pts_val))
                
    if not scores: # If no valid scores were found
        return None

    # Find the best combination
    best_score, best_eps, best_min_pts = max(scores, key=lambda x: x[0])
    
    # Create the plot for the best score
    best_title = f"ε = {best_eps:.2f}, MinPts = {best_min_pts}"
    best_fig = run_and_plot_grid(_X_scaled, X_orig, features, best_eps, best_min_pts, best_title)
    
    return best_eps, best_min_pts, best_score, best_fig


# --- Main Application ---
st.title("🔬 DBSCAN Interactive Explainer")
st.markdown(f"Demonstrating DBSCAN for **{dataset_choice.split(':')[0]}**")

# Load data
df, features = get_data(dataset_choice)

# Prepare data for DBSCAN
X = df[features]
scaler = StandardScaler() # Create instance
X_scaled = scaler.fit_transform(X) # Fit and transform

# Run DBSCAN (for the final plot)
db = DBSCAN(eps=eps, min_samples=min_pts)
clusters = db.fit_predict(X_scaled)

# --- ADVANCED VISUALIZATION: Identify Core, Border, and Noise points ---
core_samples_mask = np.zeros_like(db.labels_, dtype=bool)
core_samples_mask[db.core_sample_indices_] = True
df['Cluster'] = [str(c) for c in clusters] # Use string for discrete colors
df['Point Type'] = 'Noise' # Default to Noise
df.loc[core_samples_mask, 'Point Type'] = 'Core' # Mark Core points
is_border = ~(core_samples_mask) & (df['Cluster'] != '-1')
df.loc[is_border, 'Point Type'] = 'Border'
n_clusters = len(set(clusters)) - (1 if -1 in clusters else 0)
n_noise = list(clusters).count(-1)

# --- NEW: Calculate Silhouette Score for main plot ---
main_score = calculate_silhouette(X_scaled, clusters)
main_score_str = f" | Happiness: {main_score:.2f}" if main_score is not None else ""


# --- Layout ---
# *** NEW LAYOUT: 1 part text, 2 parts graph ***
col1, col2 = st.columns([1, 2]) 

# --- Column 1: Contextual Explanations (MOVED) ---
with col1:
    st.subheader("The Analogy Explained")
    
    if dataset_choice == "Civil: Pothole Hotspots":
        st.markdown(
            """
            **The Problem:** We have the GPS coordinates of all reported potholes. We need to find *hotspots*—areas with a high density of potholes—to schedule priority repairs.
            
            **Epsilon (ε):** This is our 'inspection radius' (e..g, how close potholes must be to be related).
            
            **MinPts:** This is the 'critical mass' (e.g., how many potholes are needed to form a core hotspot).
            
            **Interpreting the Plot:**
            * **Core (●):** This is the *center* of a hotspot. A pothole with many other potholes right next to it. These are high-priority.
            * **Border (■):** This pothole is on the *edge* of a hotspot. It's still part of the problem zone, but not as critical as the core.
            * **Noise (X):** An *isolated* pothole. It's out on its own, not part of a dense cluster. These can be fixed with lower priority.
            """
        )
    
    elif dataset_choice == "Bio-Chem: Molecule Families":
        st.markdown(
            """
            **The Problem:** We're looking at molecules plotted by their properties. We need to find 'families' of molecules that behave similarly for drug discovery.
            
            **Epsilon (ε):** This is the 'property similarity' radius (e.g., how similar molecules must be to be neighbors).
            
            **MinPts:** This is the 'family size' rule (e.g., how many similar molecules form a core group).
            
            **Interpreting the Plot:**
            * **Core (●):** An *archetype* molecule. This molecule is a perfect example of this family, with many other similar molecules nearby.
            * **Border (■):** A *"cousin"* molecule. It's clearly related to the family, but on the edge of the group's properties.
            * **Noise (X):** A *unique* molecule. Its properties are very different from any other group. This could be a mistake, or a new, interesting discovery!
            """
        )

    elif dataset_choice == "CBI: Credit Fraud Rings":
        st.markdown(
            """
            **The Problem:** We're analyzing transactions to find 'fraud rings'—small, dense clusters of transactions that are very close in *time* and *amount*.
            
            **Epsilon (ε):** This is the 'suspicious proximity' window (e.g., how close in time/amount transactions must be).
            
            **MinPts:** This is the 'fraud ring threshold' (e.g., how many linked transactions signal a core fraud event).
            
            **Interpreting the Plot:**
            * **Core (●):** A *core fraudulent transaction*. This is the center of a suspicious event, with many other similar transactions linked to it.
            * **Border (■):** A *related transaction*. This is part of the fraud ring, but on its edge (e.g., the first or last transaction in the batch).
            * **Noise (X):** A *normal transaction*. This is just an everyday purchase that isn't part of any suspicious cluster.
            """
        )

    elif dataset_name == "Sports: Shot Chart Hotspots":
        st.markdown(
            """
            **The Problem:** We have the court coordinates of every shot a player took. We need to find their 'hotspots'—the areas where they shoot from most often.
            
            **Epsilon (ε):** This is the 'shooting pocket' radius (e.g., how close shots must be to be from the same "spot").
            
            **MinPts:** This is the 'shot frequency' threshold (e.g., how many shots are needed to make a "core" hotspot).
            
            **Interpreting the Plot:**
            * **Core (●):** This is the player's *sweet spot*. A shot taken from the very center of their favorite, high-volume zone.
            * **Border (■):** A shot *near* a hotspot. Still in their comfort zone, but on the edge, not their 'go-to' spot.
            * **Noise (X):** An *unusual shot*. A rare attempt from a part of the court the player doesn't normally shoot from.
            """
        )

# --- Column 2: The Plot (Animation or Final) (MOVED) ---
with col2:
    plot_placeholder = st.empty() # Placeholder

    if run_animation:
        # Run the full animation
        st.subheader("Algorithm in Progress...")
        
        # --- FIX FOR BLINKING ---
        # 1. Create the initial figure ONCE.
        # All points are unvisited.
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=df[features[0]],
            y=df[features[1]],
            mode='markers',
            marker=dict(
                color=['lightgrey'] * len(df), # Set initial color
                symbol=['circle'] * len(df),  # Set initial symbol
                size=[6] * len(df),           # Set initial size
                opacity=0.8,
                line=dict(width=1, color='Black')
            ),
            text=[f"Point {i}" for i in df.index],
            name='Points'
        ))
        fig.update_layout(
            title="Starting Animation... Algorithm is running.", # <-- FIXED TITLE
            xaxis_title=f"{features[0]} (Original Data)",
            yaxis_title=f"{features[1]} (Original Data)",
            showlegend=False,
            height=600,
            margin=dict(l=0, r=0, t=40, b=0)
        )
        
        # Draw the initial plot
        plot_placeholder.plotly_chart(fig, use_container_width=True)
        # --- END FIX ---

        color_map = {
            0: 'lightgrey',   # Unvisited
            -1: 'black',      # Noise
            -2: 'red',        # Checking
            -3: 'green',      # Core (Changed from red to green)
        }
        for i in range(1, 11): # Up to 10 clusters
            color_map[i] = px.colors.qualitative.Vivid[i % 10]

        for frame in visual_dbscan(X_scaled, eps, min_pts):
            # --- FIX FOR BLINKING ---
            # 2. Update the existing figure's data and layout
            
            # Update markers
            anim_color = [color_map.get(l, 'grey') for l in frame['labels']]
            anim_symbol = ['x' if l == -1 else 'circle' for l in frame['labels']]
            anim_size = [8 if l == -2 or l == -3 else 6 for l in frame['labels']]
            
            # Use a Batch Update to modify the existing scatter plot
            with fig.batch_update():
                fig.data[0].marker.color = anim_color
                fig.data[0].marker.symbol = anim_symbol
                fig.data[0].marker.size = anim_size
                
                # Update title
                fig.layout.title = frame['title']

                # Update shape (epsilon ellipse)
                checking_point_idx = frame.get('checking_point')
                if checking_point_idx is not None:
                    # *** NEW LOGIC FOR ELLIPSE COLOR ***
                    point_status = frame['labels'][checking_point_idx]
                    if point_status == STATUS_CORE: # <-- FIXED NameError
                        ellipse_line_color = "Green"
                        ellipse_fill_color = "rgba(0, 255, 0, 0.1)"
                    else: # Default to red for STATUS_CHECKING
                        ellipse_line_color = "Red"
                        ellipse_fill_color = "rgba(255, 0, 0, 0.1)"
                    # *** END NEW LOGIC ***

                    center_x = df.iloc[checking_point_idx][features[0]]
                    center_y = df.iloc[checking_point_idx][features[1]]
                    radius_x = eps * scaler.scale_[0]
                    radius_y = eps * scaler.scale_[1]
                    
                    # Update layout with the new shape
                    fig.layout.shapes = [
                        dict(
                            type="circle",
                            xref="x", yref="y",
                            x0=center_x - radius_x, y0=center_y - radius_y,
                            x1=center_x + radius_x, y1=center_y + radius_y,
                            line_color=ellipse_line_color, # <-- Use variable
                            line_width=2,
                            opacity=0.3,
                            fillcolor=ellipse_fill_color # <-- Use variable
                        )
                    ]
                else:
                    fig.layout.shapes = [] # Remove ellipse
            
            # 3. Redraw the *same* figure object
            plot_placeholder.plotly_chart(fig, use_container_width=True)
            # --- END FIX ---

            # *** NEW: Use speed_multiplier for sleep time ***
            if frame.get("checking_point") is not None:
                time.sleep(0.35 * speed_multiplier) # Slower pause when checking a point
            elif "Expanding" in frame["title"]: 
                time.sleep(0.1 * speed_multiplier) # Faster pause for point-by-point spread
            else:
                time.sleep(0.05 * speed_multiplier) # Faster for noise
        
        st.success("Animation complete! The main plot below shows the final result.")
        
        # After animation, show the final, rich plot
        st.subheader("Final Clustering Result")
        st.markdown("This plot shows the final result on the *original* data. Use the symbols to identify **Core (●)**, **Border (■)**, and **Noise (X)** points.")
        fig_final = px.scatter(
            df, 
            x=features[0], 
            y=features[1], 
            color='Cluster',
            symbol='Point Type',
            # --- UPDATED TITLE ---
            title=f"Found {n_clusters} clusters, {n_noise} noise points{main_score_str}",
            color_discrete_sequence=px.colors.qualitative.Vivid,
            hover_data=['Cluster', 'Point Type'],
            category_orders={"Point Type": ["Core", "Border", "Noise"]}
        )
        
        # Manually set symbols
        fig_final.update_traces(
            marker=dict(size=9, opacity=0.9, line=dict(width=1, color='Black')),
        )
        fig_final.for_each_trace(
            lambda trace: trace.update(marker_symbol='circle') if trace.name.endswith('Core') else (),
        )
        fig_final.for_each_trace(
            lambda trace: trace.update(marker_symbol='square') if trace.name.endswith('Border') else (),
        )
        fig_final.for_each_trace(
            lambda trace: trace.update(marker_symbol='x', marker_size=7) if trace.name.endswith('Noise') else (),
        )
        fig_final.update_layout(
            legend_title_text='Cluster / Type',
            legend_traceorder='reversed',
            margin=dict(l=0, r=0, t=40, b=0),
            height=600
        )
        plot_placeholder.plotly_chart(fig_final, use_container_width=True) # Draw in the same placeholder

    else:
        # *** LOGIC CHANGED: Show the 'fig_final' plot by default ***
        st.subheader("Final ClusteringResult")
        st.markdown("This plot shows the final result on the *original* data. Use the symbols to identify **Core (●)**, **Border (■)**, and **Noise (X)** points. Click 'Run Step-by-Step Animation' in the sidebar to see how this result was found.")
        
        # Build the final plot
        fig_final = px.scatter(
            df, 
            x=features[0], 
            y=features[1], 
            color='Cluster',
            symbol='Point Type',
            # --- UPDATED TITLE ---
            title=f"Found {n_clusters} clusters, {n_noise} noise points{main_score_str}",
            color_discrete_sequence=px.colors.qualitative.Vivid,
            hover_data=['Cluster', 'Point Type'],
            category_orders={"Point Type": ["Core", "Border", "Noise"]}
        )
        
        # Manually set symbols
        fig_final.update_traces(
            marker=dict(size=9, opacity=0.9, line=dict(width=1, color='Black')),
        )
        fig_final.for_each_trace(
            lambda trace: trace.update(marker_symbol='circle') if trace.name.endswith('Core') else (),
        )
        fig_final.for_each_trace(
            lambda trace: trace.update(marker_symbol='square') if trace.name.endswith('Border') else (),
        )
        fig_final.for_each_trace(
            lambda trace: trace.update(marker_symbol='x', marker_size=7) if trace.name.endswith('Noise') else (),
        )
        fig_final.update_layout(
            legend_title_text='Cluster / Type',
            legend_traceorder='reversed',
            margin=dict(l=0, r=0, t=40, b=0), 
            height=600
        )
        plot_placeholder.plotly_chart(fig_final, use_container_width=True)

# --- END OF COLUMNS ---

# --- NEW 2x2 GRID SECTION ---
st.markdown("---") # Add a horizontal line

# --- NEW: Explanation for Silhouette Score ---
st.subheader("How to Find the 'Best' Parameters?")

# NEW: Dataset-specific explanations for the score
score_explanations = {
    "Civil: Pothole Hotspots": "A high score means we've clearly identified separate pothole hotspots.",
    "Bio-Chem: Molecule Families": "A high score means we've found distinct molecule families.",
    "CBI: Credit Fraud Rings": "A high score means we've successfully isolated suspicious fraud rings from normal users.",
    "Sports: Shot Chart Hotspots": "A high score means we've found well-defined shooting 'hotspots'."
}
dataset_specific_goal = score_explanations.get(dataset_choice, "Find the best-fitting clusters.")


st.info(
    f"""
    We use a **Cluster Happiness Score** (or Silhouette Score) from -1 to +1.
    A high score (near +1) means points are happy and fit well in their cluster.
    
    **Goal for this dataset:** {dataset_specific_goal}
    """
)

# --- NEW: Best Parameter Finder ---
st.subheader("🏆 Best Parameters Found")
st.markdown("We tested **40 different parameter combinations** in the background to find the 'happiest' clustering for this dataset.")

best_params = find_best_parameters(X_scaled, X, features)

if best_params:
    best_eps, best_min_pts, best_score, best_fig = best_params
    
    best_col1, best_col2 = st.columns(2)
    with best_col1:
        st.metric("Best Epsilon (ε)", f"{best_eps:.2f}")
        st.metric("Best MinPts", f"{best_min_pts}")
        st.metric("Best Happiness Score", f"{best_score:.2f}")
    with best_col2:
        st.plotly_chart(best_fig, use_container_width=True)
else:
    st.warning("Could not find a set of parameters that produced a valid Happiness Score (this usually means no clusters were found).")


# --- 2x2 Grid Section ---
st.markdown("---")
st.subheader("Why Parameters Matter: A 2x2 Grid")
st.markdown(f"""
    See how changing `Epsilon (ε)` and `MinPts` dramatically changes the results. 
    This grid shows four common scenarios to help you understand what the parameters do.
    (The sliders in the sidebar control the main plot above, not this grid).
""")

# Define low/high values
eps_low = 0.30
eps_high = 0.80
min_pts_low = 3
min_pts_high = 7

# --- UPDATED: No longer need to find 'best' here ---
grid_col1, grid_col2 = st.columns(2)

with grid_col1:
    title_ll = f"Low ε ({eps_low}), Low MinPts ({min_pts_low})"
    fig_ll = run_and_plot_grid(X_scaled, X, features, eps_low, min_pts_low, title_ll)
    st.plotly_chart(fig_ll, use_container_width=True)

    title_lh = f"Low ε ({eps_low}), High MinPts ({min_pts_high})"
    fig_lh = run_and_plot_grid(X_scaled, X, features, eps_low, min_pts_high, title_lh)
    st.plotly_chart(fig_lh, use_container_width=True)

with grid_col2:
    title_hl = f"High ε ({eps_high}), Low MinPts ({min_pts_low})"
    fig_hl = run_and_plot_grid(X_scaled, X, features, eps_high, min_pts_low, title_hl)
    st.plotly_chart(fig_hl, use_container_width=True)

    title_hh = f"High ε ({eps_high}), High MinPts ({min_pts_high})"
    fig_hh = run_and_plot_grid(X_scaled, X, features, eps_high, min_pts_high, title_hh)
    st.plotly_chart(fig_hh, use_container_width=True)

