from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button


class JarvisApp(App):
    def build(self):
        layout = BoxLayout(orientation="vertical", padding=15, spacing=10)

        self.natija = Label(
            text="Assalomu alaykum! Men JARVISman.",
            font_size=20
        )

        self.savol = TextInput(
            hint_text="JARVISga savol yozing...",
            multiline=False,
            size_hint_y=None,
            height=50
        )

        tugma = Button(
            text="Yuborish",
            size_hint_y=None,
            height=50
        )
        tugma.bind(on_press=self.javob)

        layout.add_widget(self.natija)
        layout.add_widget(self.savol)
        layout.add_widget(tugma)

        return layout

    def javob(self, instance):
        matn = self.savol.text.strip()
        if matn:
            self.natija.text = "Siz yozdingiz: " + matn
            self.savol.text = ""


JarvisApp().run()
