import AppIntents
import SwiftUI

/**
 * Official Apple App Intents integration for El Dorado.
 * Note: iOS does NOT allow third-party apps to run unrestricted always-on background
 * custom wake-word detection ("Hey El Dorado"). Users invoke El Dorado via Siri Shortcuts
 * ("Hey Siri, ask El Dorado..."), Home Screen Widgets, Action Button, or in-app microphone button.
 */
@available(iOS 16.0, *)
struct AskDopeIntent: AppIntent {
    static var title: LocalizedStringResource = "Run El Dorado Voice Command"
    static var description = IntentDescription("Sends a natural voice instruction to your El Dorado assistant.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Command")
    var command: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        return .result(dialog: "Sending '\(command)' to El Dorado.")
    }
}

@available(iOS 16.0, *)
struct DopeShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskDopeIntent(),
            phrases: [
                "Ask \(.applicationName) \(\.$command)",
                "Run \(.applicationName) command"
            ],
            shortTitle: "Ask El Dorado",
            systemImageName: "waveform"
        )
    }
}
