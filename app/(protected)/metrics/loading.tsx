export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-100" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
      <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
