export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <div className="container mx-auto px-4 lg:px-8 py-8">
        <div className="animate-pulse">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-emerald-200 rounded"></div>
              <div className="h-10 bg-emerald-200 rounded w-80"></div>
            </div>
            <div className="h-6 bg-slate-200 rounded w-96"></div>
          </div>

          {/* Cards Skeleton */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-emerald-100 p-6">
                <div className="h-6 bg-slate-200 rounded w-24 mb-4"></div>
                <div className="h-8 bg-slate-200 rounded w-16 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-32"></div>
              </div>
            ))}
          </div>

          {/* Chart Skeletons */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-emerald-100 p-6">
                <div className="h-6 bg-slate-200 rounded w-40 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-64 mb-4"></div>
                <div className="h-48 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>

          {/* Records Skeleton */}
          <div className="bg-white rounded-lg border border-emerald-100 p-6">
            <div className="h-6 bg-slate-200 rounded w-48 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-xl">
                  <div className="h-6 bg-slate-200 rounded w-48 mb-4"></div>
                  <div className="grid md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="h-4 bg-slate-200 rounded"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
