plugins {
    alias(libs.plugins.ktor)
    kotlin("jvm")
    id("org.jetbrains.kotlin.plugin.serialization")
}

group = "com.github.enteraname74.cloudy"
version = "0.0.1"

ktor {
    docker {
        localImageName.set("cloudy-docker-image")
        imageTag.set("0.0.1")
        jreVersion.set(JavaVersion.VERSION_21)
    }
}

application {
    mainClass.set("io.ktor.server.netty.EngineMain")

    val isDevelopment = System.getenv("DEV_MODE").toBoolean()
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":config"))
    implementation(project(":logging"))

    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.websockets)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.server.resources)
    implementation(libs.ktor.server.request.validation)
    implementation(libs.ktor.server.status.page)
    implementation(libs.ktor.server.partial.content)
    implementation(libs.ktor.server.swagger)

    implementation(libs.ktor.simple.cache)
    implementation(libs.ktor.server.netty)
    implementation("io.ktor:ktor-server-default-headers:3.4.1")

    testImplementation(libs.kotlin.test.junit)

    implementation(libs.bundles.koin)
}

kotlin {
    compilerOptions {
        optIn.add("kotlin.uuid.ExperimentalUuidApi")
    }
}

val skipWebUi: Boolean = providers.gradleProperty("skipWebUi")
    .map(String::toBoolean)
    .orElse(false)
    .get()

val webDir = rootProject.layout.projectDirectory.dir("web")
val webUiOutput = layout.buildDirectory.dir("generated/webUi")
val npmExecutable: String =
    if (System.getProperty("os.name").lowercase().contains("windows")) "npm.cmd" else "npm"

fun isNpmAvailable(): Boolean =
    try {
        ProcessBuilder(npmExecutable, "--version")
            .redirectErrorStream(true)
            .start()
            .waitFor() == 0
    } catch (_: Exception) {
        false
    }

val shouldBuildWebUi: Boolean =
    !skipWebUi &&
        webDir.file("package.json").asFile.exists() &&
        isNpmAvailable()

sourceSets {
    main {
        resources.srcDir(webUiOutput)
    }
}

val npmCiWebUi by tasks.registering(Exec::class) {
    group = "web"
    description = "Install web UI npm dependencies"
    workingDir = webDir.asFile
    commandLine(npmExecutable, "ci")
    onlyIf { shouldBuildWebUi }
    inputs.files(
        webDir.file("package.json"),
        webDir.file("package-lock.json"),
    )
    outputs.dir(webDir.dir("node_modules"))
}

val buildWebUi by tasks.registering(Exec::class) {
    group = "web"
    description = "Build the React admin UI"
    dependsOn(npmCiWebUi)
    workingDir = webDir.asFile
    commandLine(npmExecutable, "run", "build")
    onlyIf { shouldBuildWebUi }
    inputs.dir(webDir.dir("src"))
    inputs.files(
        webDir.file("package.json"),
        webDir.file("package-lock.json"),
        webDir.file("vite.config.ts"),
        webDir.file("index.html"),
        webDir.file("tsconfig.json"),
        webDir.file("tsconfig.app.json"),
    )
    outputs.dir(webDir.dir("dist"))
}

val copyWebUi by tasks.registering(Copy::class) {
    group = "web"
    description = "Copy the built React UI into Ktor resources"
    dependsOn(buildWebUi)
    onlyIf { shouldBuildWebUi }
    from(webDir.dir("dist"))
    into(webUiOutput.map { it.dir("web") })
}

tasks.named<ProcessResources>("processResources") {
    dependsOn(copyWebUi)
}

tasks.test {
    useJUnitPlatform()
}
