package com.github.enteraname74.cloudy.controller.routing.web

import io.ktor.http.HttpStatusCode
import io.ktor.server.http.content.singlePageApplication
import io.ktor.server.response.respondRedirect
import io.ktor.server.response.respondText
import io.ktor.server.routing.Routing
import io.ktor.server.routing.get

fun Routing.webUiRouting() {
    val webUiAvailable = this::class.java.classLoader.getResource("web/index.html") != null

    if (webUiAvailable) {
        singlePageApplication {
            useResources = true
            filesPath = "web"
            defaultPage = "index.html"
            applicationRoute = "/admin"
        }
        get("/") {
            call.respondRedirect("/admin")
        }
    } else {
        get("/admin") {
            call.respondText(
                text = "Cloudy web UI is not packaged...",
                status = HttpStatusCode.ServiceUnavailable,
            )
        }
    }
}
