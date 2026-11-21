package com.dope.assistant

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground microphone service for optional "Hey Dop" wake-word mode.
 * Always displays a persistent, transparent system notification whenever the microphone is active.
 */
class DopeListeningService : Service() {

    companion object {
        const val CHANNEL_ID = "dope_mic_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP = "com.dope.assistant.STOP_LISTENING"
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        createNotificationChannel()
        val stopIntent = Intent(this, DopeListeningService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPending = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("DOPE is listening for \"Hey Dop\"")
            .setContentText("Audio stays on-device until wake phrase triggers.")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .addAction(
                Notification.Action.Builder(
                    null,
                    "Stop Listening",
                    stopPending
                ).build()
            )
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_STICKY
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "DOPE Microphone Status",
            NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
