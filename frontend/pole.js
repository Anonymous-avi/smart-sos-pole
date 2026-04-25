const { useState, useEffect } = React;

const sensors = [
  { id: "camera", posY: 10, status: "normal" },
  { id: "sos", posY: 30, status: "normal" },
  { id: "temp", posY: 50, status: "warning" },
  { id: "sound", posY: 70, status: "warning" },
  { id: "power", posY: 90, status: "normal" }
];

const statusColor = {
  normal: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444"
};

function Pole() {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => !p);
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    React.createElement("div", {
      style: {
        position: "relative",
        width: "24px",
        height: "450px"
      }
    },

      // POLE BODY
      React.createElement("div", {
        style: {
          width: "100%",
          height: "100%",
          borderRadius: "12px",
          background: "linear-gradient(#1a1f2e, #3d4870)",
          boxShadow: "0 0 10px rgba(99,179,237,0.2)"
        }
      }),

      // TOP LIGHT
      React.createElement("div", {
        style: {
          position: "absolute",
          top: "-20px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: pulse ? "#3b82f6" : "#60a5fa",
          boxShadow: pulse
            ? "0 0 30px rgba(59,130,246,0.7)"
            : "0 0 15px rgba(59,130,246,0.4)",
          transition: "all 0.6s ease"
        }
      }),

      // SENSOR DOTS
      sensors.map(sensor =>
        React.createElement("div", {
          key: sensor.id,
          style: {
            position: "absolute",
            top: sensor.posY + "%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: statusColor[sensor.status],
            boxShadow: `0 0 10px ${statusColor[sensor.status]}`,
          }
        })
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("pole-root")).render(
  React.createElement(Pole)
);