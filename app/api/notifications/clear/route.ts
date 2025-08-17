import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

// WARNING: destructive. This route is intended for local/dev use only.
// It will only run when NODE_ENV !== 'production' OR when the caller
// provides a matching ADMIN_DELETE_TOKEN via the x-admin-token header.

export async function POST(request: NextRequest) {
  try {
    const adminToken = process.env.ADMIN_DELETE_TOKEN || null
    const headerToken = request.headers.get('x-admin-token')

    if (process.env.NODE_ENV === 'production' && (!adminToken || headerToken !== adminToken)) {
      return NextResponse.json({ ok: false, message: 'Not allowed in production without admin token' }, { status: 403 })
    }

    const db = await getDatabase()
    const notificationsCol = db.collection('notifications')
    const pendingCol = db.collection('pending_notifications')

    const notifDel = await notificationsCol.deleteMany({})
    const pendingDel = await pendingCol.deleteMany({})

    return NextResponse.json({ ok: true, deletedNotifications: notifDel.deletedCount, deletedPending: pendingDel.deletedCount })
  } catch (err: any) {
    console.error('Failed to clear notifications', err)
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
