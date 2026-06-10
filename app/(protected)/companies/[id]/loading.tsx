export default function Loading() {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-50 p-6 gap-4">
      {/* Header bar */}
      <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-100" />
      {/* Company card */}
      <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      {/* Contacts + Org chart row */}
      <div className="flex gap-4" style={{ minHeight: 300 }}>
        <div className="w-[55%] animate-pulse rounded-xl bg-gray-100" />
        <div className="w-[45%] animate-pulse rounded-xl bg-gray-100" />
      </div>
      {/* Tabs section */}
      <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
    </div>
  )
}
