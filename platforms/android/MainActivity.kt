package com.dope.assistant

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                DopeAndroidHome()
            }
        }
    }
}

@Composable
fun DopeAndroidHome() {
    val context = LocalContext.current
    var micGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var foregroundListening by remember { mutableStateOf(false) }
    var statusText by remember { mutableStateOf("Tap Activate or enable Hey El Dorado foreground mode.") }

    val micLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        micGranted = granted
        statusText = if (granted) "Microphone permission granted." else "Microphone permission denied."
    }

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("El Dorado Assistant", style = MaterialTheme.typography.headlineMedium)
            Text(statusText, style = MaterialTheme.typography.bodyMedium)

            if (!micGranted) {
                Button(onClick = { micLauncher.launch(Manifest.permission.RECORD_AUDIO) }) {
                    Text("Allow Microphone Access")
                }
            } else {
                Button(onClick = {
                    foregroundListening = !foregroundListening
                    val intent = Intent(context, DopeListeningService::class.java)
                    if (foregroundListening) {
                        context.startForegroundService(intent)
                        statusText = "Listening for 'Hey El Dorado' with active microphone notification."
                    } else {
                        context.stopService(intent)
                        statusText = "Foreground listening stopped."
                    }
                }) {
                    Text(if (foregroundListening) "Stop Listening" else "Enable Hey El Dorado Mode")
                }

                OutlinedButton(onClick = {
                    val urlIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com"))
                    context.startActivity(urlIntent)
                }) {
                    Text("Test: Open YouTube")
                }
            }
        }
    }
}
