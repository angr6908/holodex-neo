export function PlaceholderOverlay({ showOnlyOnHover = false }: { width?: number; height?: number; showOnlyOnHover?: boolean }) {
  return (
    <div className={`placeholder-overlay${showOnlyOnHover ? " show-on-hover" : ""}`}>
      <div className="placeholder-content">
        <svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg" className="placeholder-svg">
          <g className="placeholder-line" stroke="var(--v-background-darken3)" strokeDasharray="0,20" strokeLinecap="round" strokeWidth="12">
            <line y1={225 * 2 / 10} y2={225 * 8.4 / 10} x1="0" x2="0" />
            <line y1={225 * 2 / 10} y2={225 * 8.4 / 10} x1="400" x2="400" />
          </g>
        </svg>
      </div>
    </div>
  );
}
