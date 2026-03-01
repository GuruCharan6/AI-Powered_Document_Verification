const ScoreRing = ({ score, size = 120, strokeWidth = 8, label }) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (score / 100) * circumference
    
    const getColor = () => {
      if (score >= 80) return '#10b981'
      if (score >= 60) return '#3b82f6'
      if (score >= 40) return '#f59e0b'
      return '#ef4444'
    }
  
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="transform -rotate-90" width={size} height={size}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={getColor()}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-primary-900">{score}%</span>
          </div>
        </div>
        {label && <span className="text-sm font-medium text-primary-600">{label}</span>}
      </div>
    )
  }
  
  export default ScoreRing