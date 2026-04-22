gsap.registerPlugin(ScrollTrigger);

/**
* Scrolltrigger Scroll Check
*/
function initScrolltriggerNav() {

  ScrollTrigger.create({
    start: 'top -30%',
    onUpdate: self => {
      $("main").addClass('scrolled');
    },
    onLeaveBack: () => {
      $("main").removeClass('scrolled');
    },
  });

}

/**
* Scrolltrigger Scroll Letters Home
*/
function initScrollLetters() {
  // Scrolling Letters Both Direction
  // https://codepen.io/GreenSock/pen/rNjvgjo
  // Fixed example with resizing
  // https://codepen.io/GreenSock/pen/QWqoKBv?editors=0010

  let direction = 1; // 1 = forward, -1 = backward scroll

  const roll1 = roll(".name-wrap", {duration: 18}),
        roll2 = roll(".rollingText02", {duration: 10}, true),
        scroll = ScrollTrigger.create({
          trigger: document.querySelector('[data-scroll-container]'),
          onUpdate(self) {
            if (self.direction !== direction) {
              direction *= -1;
              gsap.to([roll1, roll2], {timeScale: direction, overwrite: true});
            }
          }
        });

  // helper function that clones the targets, places them next to the original, then animates the xPercent in a loop to make it appear to roll across the screen in a seamless loop.
  function roll(targets, vars, reverse) {
    vars = vars || {};
    vars.ease || (vars.ease = "none");
    const tl = gsap.timeline({
            repeat: -1,
            onReverseComplete() {
              this.totalTime(this.rawTime() + this.duration() * 10); // otherwise when the playhead gets back to the beginning, it'd stop. So push the playhead forward 10 iterations (it could be any number)
            }
          }),
          elements = gsap.utils.toArray(targets),
          clones = elements.map(el => {
            let clone = el.cloneNode(true);
            el.parentNode.appendChild(clone);
            return clone;
          }),
          positionClones = () => elements.forEach((el, i) => gsap.set(clones[i], {position: "absolute", overwrite: false, top: el.offsetTop, left: el.offsetLeft + (reverse ? -el.offsetWidth : el.offsetWidth)}));
    positionClones();
    elements.forEach((el, i) => tl.to([el, clones[i]], {xPercent: reverse ? 100 : -100, ...vars}, 0));
    window.addEventListener("resize", () => {
      let time = tl.totalTime(); // record the current time
      tl.totalTime(0); // rewind and clear out the timeline
      positionClones(); // reposition
      tl.totalTime(time); // jump back to the proper time
    });
    return tl;
  }

}




/*
 ╔═══════════════════════════════════════════════════╗
 ║     ____                  ____                    ║
 ║    / ___|_   _ _ __ ___  / ___|_   _ _ __ ___     ║
 ║   | |  _| | | | '_ ` _ \| |  _| | | | '_ ` _ \    ║
 ║   | |_| | |_| | | | | | | |_| | |_| | | | | | |   ║
 ║    \____|\__,_|_| |_| |_|\____|\__,_|_| |_| |_|   ║
 ║                                                   ║
 ╠═══════════════════════════════════════════════════╝
 ║
 *
 * WebGL GumGum (InteractiveArts composition)
 * version: 1.4
 * update: 18.11.2017
 * author: alexkulagin.com
 *
 **/


!(function() {

	'use strict';


	function GumGum ()
	{
		const 	GroundColor		= 0x121214,
				GumColor		= 0x3effe8,
				AmbientColor	= 0x8C0FEE,
				LightColor		= 0x3effe8,

				GumContainer	= 'GumWebGL';

		// --------

		var vw = window.innerWidth,
			vh = window.innerHeight;

		const	scene = new THREE.Scene(),
				renderer = new THREE.WebGLRenderer({ antialias: true }),
				camera = new THREE.PerspectiveCamera(45, vw / vh, 0.1, 1000),
				ambient = new THREE.AmbientLight(AmbientColor),
				light = new THREE.DirectionalLight(LightColor, 7),
				geometry = new THREE.IcosahedronGeometry(25, 5),
				material = new THREE.MeshLambertMaterial({ color: AmbientColor, wireframe: false}),
				sphere = new THREE.Mesh(geometry, material),
				noise = new SimplexNoise();


		// --------

		scene.autoUpdate = true;
		scene.background = new THREE.Color(GroundColor);

		renderer.setClearColor(new THREE.Color(GroundColor));
		renderer.setSize(vw, vh);

		camera.position.x = 0;
		camera.position.y = 0;
		camera.position.z = 65;
		camera.lookAt(scene.position);

		sphere.position.x = 0;
		sphere.position.y = 0;
		sphere.position.z = 0;
		sphere.castShadow = false;

		light.position.set( 10, 10, 2 );

		// --------

		scene.add(camera);
		scene.add(sphere);
		scene.add(ambient);
		scene.add(light);

		// --------

		document.getElementsByClassName(GumContainer)[0].appendChild(renderer.domElement);

		// --------

		// postprocessing

		/*var	composer = new THREE.EffectComposer(renderer);
			composer.addPass( new THREE.RenderPass(scene, camera));

		var	glitchPass = new THREE.GlitchPass();
			glitchPass.renderToScreen = true;

		composer.addPass(glitchPass);*/

		// --------

		var sgeom = sphere.geometry,
			offset = sgeom.parameters.radius,
			f = { x: 0.00001, y: 0.00001, z: 0.00010, a: 3 };

		this.update = function ()
		{
			var t = Date.now();

			sgeom.vertices.forEach(function(v, i) {
				v.normalize();
				v.multiplyScalar(offset + noise.noise3D(v.x + t * f.x, v.y + t * f.y, v.z + t * f.z) * f.a);
			});

			sgeom.verticesNeedUpdate = true;
			sgeom.normalsNeedUpdate = true;

			sgeom.computeVertexNormals();
			sgeom.computeFaceNormals();

			renderer.render(scene, camera);
			//composer.render();
		};

		this.resize = function ()
		{
			vw = window.innerWidth;
			vh = window.innerHeight;

			camera.aspect = vw / vh;
			camera.updateProjectionMatrix();

			renderer.setSize(vw, vh);
			//composer.setSize(vw, vh);
		};

		// --------

		this.camera = camera;
		this.sphere = sphere;
		this.light = light;
		this.f = f;
	}

	const gum = new GumGum();

	function render () {
		gum.update();
		requestAnimationFrame(render);
	}

	function resize () {
		gum.resize();
	}

	window.addEventListener('resize', resize, false);
	window.onload = function () { render() };
	window.gumgum = gum;

})();


initScrolltriggerNav();
initScrollLetters();
