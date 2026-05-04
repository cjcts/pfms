export default function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">{subtitle}</p>
      )}
    </div>
  )
}
