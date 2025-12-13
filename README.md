# **GOAL_DEMO**

Enlace de la demo (CodeSandbox): https://wq7pql.csb.app/

## Índice

- [Introducción](#introducción)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Dependencias](#dependencias)
- [Controles](#controles)
- [Vídeo de uso](#vídeo-de-uso)
- [Fuentes y Documentación](#fuentes-y-documentación)

## Introducción

El proyecto consiste en una demo interactiva en 3D de un entorno donde se puede "jugar al fútbol" enfocado en tirar penáltis (o chutar a puerta desde una posición cercana al portero). La aplicación se ejecuta directamente en el navegador web y ofrece una experiencia en primera persona similar a la que se obtiene en un **FPS** (*Fist Person Shooter*).

El objetivo principal es simular la física de la pelota a la hora del chute a portería, así como la colisión de las mismas. En la demo, el jugador posee el rol del tirador, controlando su posición y ángulo de visión para disparar a portería contra un portero automatizado.

Como pilares fundamentales del proyecto se encuentran:

- **Rederizado Gráfico:** Creación de un entorno visual con luces, sobras y texturas.

- **Motor de Físicas:** Cálculo de trayectorias, gravedad y colisiones mediante cuerpos rígidos.

- **Animación Interpolada:** Movimiento suave y continuo del portero (elemento controlado por la física directa).

## Tecnologías utilizadas

En el transcurso de la práctica se han utilizado diferentes tecnologías para llegar al objetivo propuesto:

- **VSCode:** El proyecto se ha realizado enteramente desde dicho IDE.

- **CodeSandbox:** Se ha utilizado para la pasar el código desde VSCode y obtener el enlace de la demo.

- **JavaScript:** Es el lenguaje de programación principal del proyecto. Además de HTML y CSS que han sido utilizados para la estructura del contenedor de la aplicación y la interfaz de usuario (UI).

## Dependencias

El proyecto hace uso de diversas librerías y paquetes que se han importado para usar sus funciones y utilidades. Son los siguientes:

- **Three.js:** Es el motor gráfico principal que se encarga de la carga de texturas así como de las mallas geométricas, la cámara, la carga de los modelos `.obj`y el ciclo de renderizado.

- **Cannon.js:** Se encarga de la gravedad y la detección entre el balón, el suelo, la red y el movimiento del jugador. Se ha decidido usar esta dependencia en vez de **Ammo.js** debido a que **Cannon.js** está escrito en JavaScript puro y es menos pesado. La decisión vino a raíz de que el proyecto iba extremandamente poco fluido y se realizaron modificaciones de diversos tipos para intentar optimizarlo lo máximo posible, los problemas de optimización tras mucho tiempo de pruebas era presuntamente culpa del buscador [OperaGX](https://www.opera.com/es/gx/gx-browser-nb?utm_id=Cj0KCQiA_8TJBhDNARIsAPX5qxTbhzch2oOJgCJGOIT1RSOMt5gNBAC29gT7BwtFcyKHMax9fmXzxOgaAhLlEALw_wcB&utm_medium=pa&utm_source=google&utm_campaign=OGX_ES_Search_ES_T1_V2&utm_content=635460379197&gad_source=1&gad_campaignid=18948233713&gclid=Cj0KCQiA_8TJBhDNARIsAPX5qxTbhzch2oOJgCJGOIT1RSOMt5gNBAC29gT7BwtFcyKHMax9fmXzxOgaAhLlEALw_wcB) dado que al cambiar a otro buscador (edge) funcionaba perfectamente.

- **Tween.js:** Es la librería de animación utilizada para el portero. Controla el movimiento lateral del mismo interpolando su posición (eje X) de un extremo a otro de la portería aplicando una función de suavizado para que el movimiento parezca más natural y menos robótico.

- **PointerLock API:** Es la tecnología nativa del navegador para capturar el cursor del ratón.

## Controles

El esquema de control está diseñado para ser intuitivo y reactivo, los controles se pueden ver al abrir por primera vez la demo y antes de pulsar ninguna tecla y son los siguientes:

- **Ratón:** El ratón controla la cámara del jugador al moverse, además, al hacer *click*, se lanza un balón hacia donde esté mirando el jugador.

- **Teclado:** El teclado controla tanto el movimiento horizontal como el vertical y las teclas para hacerlo son las siguientes:

    - **W:** El jugador avanza.
    - **S:** El jugador retrocede.
    - **A:** El jugador se desplaza a la izquierda.
    - **D:** El jugador se desplaza a la derecha.
    - **Espacio:** El jugador salta (se utiliza un *Raycaster* que proyecta un rayo del jugador hacia abajo, permitiendo solo el salto si el jugador está en el suelo).

## Vídeo de uso

En la siguiente imagen se puede acceder a un video corto de la demo en ejecución (*clickar* el video).

<h4 style="font-weight: bold; text-decoration: underline">Video de la demo:</h4>

[![Ver en YouTube](https://img.youtube.com/vi/5W6GfEETG1Y/0.jpg)](https://www.youtube.com/watch?v=5W6GfEETG1Y)

## Fuentes y Documentación

- **Internet:** Se ha utilizado intenet de manera recurrente para buscar en diferentes páginas los modelos 3D utilizados a lo largo de todo el proyecto, las páginas en cuestión han sido las siguientes: [free3d.com](https://free3d.com/es/?dd_referrer=https%3A%2F%2Fwww.google.com%2F), https://makerworld.com/es/3d-models, https://www.freepik.es/modelos-3d. Adicionalmente, se ha utilizado internet para la documentación necesaria para el uso de la librería [Cannon.js](https://pmndrs.github.io/cannon-es/docs/) así como la documentación de [Tween.js](https://tweenjs.github.io/tween.js/docs/user_guide.html).

- **Inteligencia Artificial Generativa (ChatGPT, Gemini):** Se ha utilizado la Inteligencia Artifical generativa para generar la geometría entera de la portería y para modificar dimensiones de la geometría del mapa. De manera adicional, se ha utilizado la IA para buscar diversas opciones de optimización de una versión preeliminar que como se ha comentado antes, el problema era presuntamente el buscador utilizado. Mencionadas optimzaciones explican por sí mismas el cambio de **Ammo.js** a **Cannon.js**.

- **Enlaces:**
    - https://free3d.com/es/?dd_referrer=https%3A%2F%2Fwww.google.com%2F
    - https://makerworld.com/es/3d-models
    - https://chatgpt.com/
    - https://youtube.com/
    - https://codesandbox.io
    - https://gemini.google.com
    - https://www.freepik.es/modelos-3d
    - https://www.opera.com/es/gx/gx-browser-nb?utm_id=Cj0KCQiA_8TJBhDNARIsAPX5qxTbhzch2oOJgCJGOIT1RSOMt5gNBAC29gT7BwtFcyKHMax9fmXzxOgaAhLlEALw_wcB&utm_medium=pa&utm_source=google&utm_campaign=OGX_ES_Search_ES_T1_V2&utm_content=635460379197&gad_source=1&gad_campaignid=18948233713&gclid=Cj0KCQiA_8TJBhDNARIsAPX5qxTbhzch2oOJgCJGOIT1RSOMt5gNBAC29gT7BwtFcyKHMax9fmXzxOgaAhLlEALw_wcB


<h4 style="text-weight: bold">--- Iván Pérez Díaz ---</h4>


