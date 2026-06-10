export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-b border-gray-100 px-6 py-3">
        <div className="h-5 w-24 animate-pulse rounded-lg bg-gray-100" />
      </div>
      <div className="flex flex-1 overflow-hidden px-6 py-4 gap-5">
        {/* Left panel */}
        <div className="w-[60%] space-y-4">
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
        </div>
        {/* Right panel */}
        <div className="w-[40%] space-y-4">
          <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  )
}
