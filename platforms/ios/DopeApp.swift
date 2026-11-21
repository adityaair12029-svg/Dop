import SwiftUI
import AVFoundation

@main
struct DopeIOSApp: App {
    var body: some Scene {
        WindowGroup {
            DopeHomeView()
        }
    }
}

struct DopeHomeView: View {
    @State private var isListening = false
    @State private var statusMessage = "Tap to speak or trigger via Siri Shortcut / Widget."

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: isListening ? "waveform.circle.fill" : "mic.circle")
                    .font(.system(size: 64))
                    .foregroundStyle(.blue)

                Text("DOPE Companion")
                    .font(.title2.bold())

                Text(statusMessage)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Button(isListening ? "Stop Listening" : "Tap to Speak") {
                    isListening.toggle()
                    statusMessage = isListening
                        ? "Microphone active in foreground."
                        : "Stopped listening."
                }
                .buttonStyle(.borderedProminent)

                Text("iOS Limitation: Continuous background custom wake-word ('Hey Dop') is restricted by iOS. Use Siri Shortcuts or Home Widgets for hands-free launch.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()
            }
            .navigationTitle("DOPE")
        }
    }
}
