import streamlit as st
import pandas as pd
import plotly.express as px
from pathlib import Path


# ============================================================
# CONFIG
# ============================================================

st.set_page_config(
    page_title="Medical Device Big Data Analytics",
    page_icon="🏥",
    layout="wide"
)

DATA_DIR = Path(__file__).parent / "data" / "generated"


# ============================================================
# LOAD DATA
# ============================================================

@st.cache_data
def load_data():

    data = {}

    files = [
        "lifecycle_event_summary",
        "lifecycle_daily",
        "device_activity",
        "device_received",
        "device_transferred",
        "maintenance_daily",
        "maintenance_by_device",
        "repair_daily",
        "repair_by_device",
    ]

    for name in files:

        path = DATA_DIR / f"{name}.csv"

        if not path.exists():
            st.error(f"Missing data file: {path}")
            continue

        data[name] = pd.read_csv(path)

    return data


if st.sidebar.button("Reload latest Spark export"):
    load_data.clear()

data = load_data()


# ============================================================
# TITLE
# ============================================================

st.title("🏥 Medical Device Big Data Analytics")

st.markdown(
    """
    **Device Lifecycle Event Analytics & Maintenance Analytics**

    **Data Pipeline**

    PostgreSQL events → JSONL export → local Spark → CSV → Dashboard (batch; refresh after Spark)
    """
)


# ============================================================
# SIDEBAR
# ============================================================

st.sidebar.title("Analytics")

page = st.sidebar.radio(
    "Select analysis",
    [
        "Overview",
        "Device Lifecycle",
        "Maintenance",
        "Repair"
    ]
)


# ============================================================
# CHECK DATA
# ============================================================

required_files = [
    "lifecycle_event_summary",
    "lifecycle_daily",
    "device_activity",
    "device_received",
    "device_transferred",
    "maintenance_daily",
    "maintenance_by_device",
    "repair_daily",
    "repair_by_device",
]

missing = [
    name for name in required_files
    if name not in data
]

if missing:

    st.error(
        "Some dashboard datasets are missing: "
        + ", ".join(missing)
    )

    st.stop()


# ============================================================
# OVERVIEW
# ============================================================

if page == "Overview":

    st.header("System Overview")

    lifecycle = data["lifecycle_event_summary"]

    total_events = int(
        lifecycle["event_count"].sum()
    )

    maintenance = int(
        lifecycle.loc[
            lifecycle["event_type"] == "MAINTENANCE_COMPLETED",
            "event_count"
        ].sum()
    )

    repair = int(
        lifecycle.loc[
            lifecycle["event_type"] == "REPAIR_COMPLETED",
            "event_count"
        ].sum()
    )

    transferred = int(
        lifecycle.loc[
            lifecycle["event_type"] == "DEVICE_TRANSFERRED",
            "event_count"
        ].sum()
    )

    received = int(
        lifecycle.loc[
            lifecycle["event_type"] == "DEVICE_RECEIVED",
            "event_count"
        ].sum()
    )

    devices = data["device_activity"]["device_id"].nunique()

    c1, c2, c3, c4, c5, c6 = st.columns(6)

    c1.metric("Total Events", f"{total_events:,}")
    c2.metric("Devices", f"{devices:,}")
    c3.metric("Maintenance", f"{maintenance:,}")
    c4.metric("Repair", f"{repair:,}")
    c5.metric("Transferred", f"{transferred:,}")
    c6.metric("Received", f"{received:,}")

    st.divider()

    # Event distribution

    st.subheader("Event Distribution")

    fig = px.bar(
        lifecycle,
        x="event_type",
        y="event_count",
        text="event_count"
    )

    fig.update_layout(
        xaxis_title="Event Type",
        yaxis_title="Number of Events"
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )

    # Daily trend

    st.subheader("Daily Event Trend")

    daily = data["lifecycle_daily"]

    fig = px.line(
        daily,
        x="event_date",
        y="event_count",
        markers=True
    )

    fig.update_layout(
        xaxis_title="Date",
        yaxis_title="Events"
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )


# ============================================================
# DEVICE LIFECYCLE
# ============================================================

elif page == "Device Lifecycle":

    st.header("Device Lifecycle Analytics")

    # --------------------------------------------------------
    # Lifecycle distribution
    # --------------------------------------------------------

    st.subheader("Lifecycle Event Distribution")

    lifecycle = data["lifecycle_event_summary"]

    fig = px.pie(
        lifecycle,
        names="event_type",
        values="event_count",
        hole=0.4
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )

    # --------------------------------------------------------
    # Most active devices
    # --------------------------------------------------------

    st.subheader("Most Active Devices")

    activity = (
        data["device_activity"]
        .sort_values(
            "total_events",
            ascending=False
        )
        .head(20)
    )

    fig = px.bar(
        activity.sort_values("total_events"),
        x="total_events",
        y="device_id",
        orientation="h"
    )

    fig.update_layout(
        xaxis_title="Total Events",
        yaxis_title="Device"
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )

    # --------------------------------------------------------
    # Received / transferred
    # --------------------------------------------------------

    c1, c2 = st.columns(2)

    with c1:

        st.subheader("Top Received Devices")

        received = (
            data["device_received"]
            .sort_values(
                "received_count",
                ascending=False
            )
            .head(10)
        )

        fig = px.bar(
            received.sort_values("received_count"),
            x="received_count",
            y="device_id",
            orientation="h"
        )

        st.plotly_chart(
            fig,
            use_container_width=True
        )

    with c2:

        st.subheader("Top Transferred Devices")

        transferred = (
            data["device_transferred"]
            .sort_values(
                "transfer_count",
                ascending=False
            )
            .head(10)
        )

        fig = px.bar(
            transferred.sort_values("transfer_count"),
            x="transfer_count",
            y="device_id",
            orientation="h"
        )

        st.plotly_chart(
            fig,
            use_container_width=True
        )


# ============================================================
# MAINTENANCE
# ============================================================

elif page == "Maintenance":

    st.header("Maintenance Analytics")

    maintenance_daily = data["maintenance_daily"]

    total = int(
        maintenance_daily["maintenance_count"].sum()
    )

    st.metric(
        "Total Maintenance Events",
        f"{total:,}"
    )

    st.subheader("Maintenance Trend")

    fig = px.line(
        maintenance_daily,
        x="event_date",
        y="maintenance_count",
        markers=True
    )

    fig.update_layout(
        xaxis_title="Date",
        yaxis_title="Maintenance Events"
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )

    st.subheader(
        "Devices with Highest Maintenance Frequency"
    )

    maintenance_device = (
        data["maintenance_by_device"]
        .sort_values(
            "maintenance_count",
            ascending=False
        )
        .head(20)
    )

    fig = px.bar(
        maintenance_device.sort_values(
            "maintenance_count"
        ),
        x="maintenance_count",
        y="device_id",
        orientation="h"
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )

    st.dataframe(
        maintenance_device,
        use_container_width=True
    )


# ============================================================
# REPAIR
# ============================================================

elif page == "Repair":

    st.header("Repair Analytics")

    repair_daily = data["repair_daily"]

    total = int(
        repair_daily["repair_count"].sum()
    )

    st.metric(
        "Total Repair Events",
        f"{total:,}"
    )

    st.subheader("Repair Trend")

    fig = px.line(
        repair_daily,
        x="event_date",
        y="repair_count",
        markers=True
    )

    fig.update_layout(
        xaxis_title="Date",
        yaxis_title="Repair Events"
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )

    st.subheader(
        "Devices with Highest Repair Frequency"
    )

    repair_device = (
        data["repair_by_device"]
        .sort_values(
            "repair_count",
            ascending=False
        )
        .head(20)
    )

    fig = px.bar(
        repair_device.sort_values(
            "repair_count"
        ),
        x="repair_count",
        y="device_id",
        orientation="h"
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )

    st.dataframe(
        repair_device,
        use_container_width=True
    )


# ============================================================
# FOOTER
# ============================================================

st.divider()

st.caption(
    "Medical Device Big Data Analytics | "
    "MongoDB + HDFS + Apache Spark + Streamlit"
)