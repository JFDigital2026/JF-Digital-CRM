export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
      <div className="h-4 w-72 animate-pulse rounded-lg bg-gray-100" />
      <div className="mt-6 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
