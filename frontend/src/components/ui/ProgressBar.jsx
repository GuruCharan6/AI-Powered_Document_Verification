const ProgressBar = ({ value, size = 'md', showValue = true }) => {
    const getColor = () => {
      if (value >= 80) return 'bg-emerald-500'
      if (value >= 60) return 'bg-blue-500'
      if (value >= 40) return 'bg-amber-500'
      return 'bg-red-500'
    }
  
    const heights = {
      sm: 'h-1.5',
      md: 'h-2',
      lg: 'h-3'
    }
  
    return (
      <div className="flex items-center gap-3">
        <div className={`flex-1 bg-primary-100 rounded-full ${heights[size]}`}>
          <div 
            className={`${heights[size]} rounded-full transition-all duration-500 ${getColor()}`}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
        {showValue && (
          <span className="text-sm font-medium text-primary-600 w-10 text-right">
            {value}%
          </span>
        )}
      </div>
    )
  }
  
  export default ProgressBar