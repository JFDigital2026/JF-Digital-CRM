export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-100" />
      <div className="grid grid-cols-4 gap-4 mt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
