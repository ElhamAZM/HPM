/**
 * @author Eberhard Graether / http://egraether.com/
 * @author Mark Lundin 	/ http://mark-lundin.com
 * @author Simone Manini / http://daron1337.github.io
 * @author Luca Antiga 	/ http://lantiga.github.io
 */

THREE.TrackballControls = function ( object, domElement ) {

	var _this = this;
	var STATE = { NONE: - 1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 };

	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// API

	this.enabled = true;

	this.screen = { left: 0, top: 0, width: 0, height: 0 };
	this.radius = 0.0;

	this.rotateSpeed = 1.0;
	this.zoomSpeed = 1.2;
	this.panSpeed = 0.3;

	this.noRotate = false;
	this.noZoom = false;
	this.noPan = false;

	this.staticMoving = false;
	this.dynamicDampingFactor = 0.2;

	this.minDistance = 0;
	this.maxDistance = Infinity;

	this.keys = [ 65 /*A*/, 83 /*S*/, 68 /*D*/ ];

	// internals

	this.target = new THREE.Vector3();

	var EPS = 0.000001;

	var lastPosition = new THREE.Vector3();

	var _state = STATE.NONE,
	_prevState = STATE.NONE,

	_eye = new THREE.Vector3(),

	_rotateStart = new THREE.Vector3(),
	_rotateEnd = new THREE.Vector3(),

	//_movePrev = new THREE.Vector2(),
	//_moveCurr = new THREE.Vector2(),

	_lastAxis = new THREE.Vector3(),
	_lastAngle = 0,

	_zoomStart = new THREE.Vector2(),
	_zoomEnd = new THREE.Vector2(),

	_touchZoomDistanceStart = 0,
	_touchZoomDistanceEnd = 0,

	_panStart = new THREE.Vector2(),
    _panEnd = new THREE.Vector2();

    // arcball stuff

    var ab_quat = new THREE.Matrix4(); ab_quat.identity();
	var ab_last = new THREE.Matrix4(); ab_last.identity();
	var ab_next = new THREE.Matrix4(); ab_next.identity();

    // the distance from the origin to the eye
    var ab_zoom = 1.0;
    var ab_zoom2 = 1.0;
    // the radius of the arcball
    var ab_sphere = 1.0;
    var ab_sphere2 = 1.0;
    // the distance from the origin of the plane that intersects
    // the edge of the visible sphere (tangent to a ray from the eye)
    var ab_edge = 1.0;
    // whether we are using a sphere or plane
    var ab_planar = false;
    var ab_planedist = 0.5;

    var ab_start = new THREE.Vector3(0, 0, 1);
    var ab_curr = new THREE.Vector3(0, 0, 1);
    var ab_eye = new THREE.Vector3(0, 0, 1);
    var ab_eyedir = new THREE.Vector3(0, 0, 1);
    var ab_up = new THREE.Vector3(0, 1, 0);
    var ab_out = new THREE.Vector3(1, 0, 0);

	var ab_glp = new THREE.Matrix4(); ab_glp.identity();
	var ab_glm = new THREE.Matrix4(); ab_glm.identity();
    var ab_glv = new THREE.Vector4(0, 0, 640, 480);

	// for reset

	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
    this.up0 = this.object.up.clone();
    this.eyeStart = _eye.clone();
    this.upStart = this.object.up.clone();

	// events

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };


	// methods

	this.handleResize = function () {

		if ( this.domElement === document ) {

			this.screen.left = 0;
			this.screen.top = 0;
			this.screen.width = window.innerWidth;
			this.screen.height = window.innerHeight;
			this.radius = ( this.screen.width + this.screen.height ) / 4;

		} else {

			var box = this.domElement.getBoundingClientRect();
			// adjustments come from similar code in the jquery offset() function
			var d = this.domElement.ownerDocument.documentElement;
			this.screen.left = box.left + window.pageXOffset - d.clientLeft;
			this.screen.top = box.top + window.pageYOffset - d.clientTop;
			this.screen.width = box.width;
			this.screen.height = box.height;
			this.radius = ( this.screen.width + this.screen.height ) / 4;

		}

		var projmatrix = new THREE.Matrix4();
		projmatrix.identity();
		arcball_setzoom(0.9, new THREE.Vector3(0, 0, _eye.length()), new THREE.Vector3(0, 1, 0), projmatrix, new THREE.Quaternion(this.screen.left, this.screen.top, this.screen.width, this.screen.height));
	};

	this.handleEvent = function ( event ) {

		if ( typeof this[ event.type ] == 'function' ) {

			this[ event.type ]( event );

		}

	};

	var getMouseOnScreen = ( function () {

		var vector = new THREE.Vector2();

		return function getMouseOnScreen( pageX, pageY ) {

			vector.set(
				( pageX - _this.screen.left ) / _this.screen.width,
				( pageY - _this.screen.top ) / _this.screen.height
			);

			return vector;

		};

	}() );

	var getMouseOnCircle = ( function () {

		var vector = new THREE.Vector2();

		return function getMouseOnCircle( pageX, pageY ) {

			vector.set(
				( ( pageX - _this.screen.width * 0.5 - _this.screen.left ) / ( _this.screen.width * 0.5 ) ),
				( ( _this.screen.height + 2 * ( _this.screen.top - pageY ) ) / _this.screen.width ) // screen.width intentional
			);

			return vector;

		};

	}() );

	
	var getMouseProjectionOnBall = ( function () {

		var vector = new THREE.Vector3();

		return function getMouseProjectionOnBall( pageX, pageY ) {
			
			var mouseOnBall = new THREE.Vector3(
				( pageX - _this.screen.width * 0.5 - _this.screen.left ) / _this.radius,
				( _this.screen.height * 0.5 + _this.screen.top - pageY ) / _this.radius,
				0.0
			);

			var length = mouseOnBall.length();

			if ( length > 1.0 ) {

				mouseOnBall.normalize();

			} else {

				mouseOnBall.z = Math.sqrt( 1.0 - length * length );

			}

			//_eye.copy( _this.object.position ).sub( _this.target );

            var projection = _this.object.up.clone().setLength( mouseOnBall.y );
            projection.add( _this.object.up.clone().cross( _this.eyeStart ).setLength( mouseOnBall.x ) );
            projection.add( _this.eyeStart.clone().setLength( mouseOnBall.z ) );

            vector.copy(projection);
			return vector;

		};

	}() );

	this.rotateCamera = ( function() {

		var axis = new THREE.Vector3(),
			quaternion = new THREE.Quaternion(),
			eyeDirection = new THREE.Vector3(),
			objectUpDirection = new THREE.Vector3(),
			objectSidewaysDirection = new THREE.Vector3(),
			moveDirection = new THREE.Vector3(),
			angle;

		return function rotateCamera() {

			/*
			moveDirection.set( _moveCurr.x - _movePrev.x, _moveCurr.y - _movePrev.y, 0 );
			angle = moveDirection.length();

			if ( angle ) {

				_eye.copy( _this.object.position ).sub( _this.target );

				eyeDirection.copy( _eye ).normalize();
				objectUpDirection.copy( _this.object.up ).normalize();
				objectSidewaysDirection.crossVectors( objectUpDirection, eyeDirection ).normalize();

				objectUpDirection.setLength( _moveCurr.y - _movePrev.y );
				objectSidewaysDirection.setLength( _moveCurr.x - _movePrev.x );

				moveDirection.copy( objectUpDirection.add( objectSidewaysDirection ) );

				axis.crossVectors( moveDirection, _eye ).normalize();

				angle *= _this.rotateSpeed;
				quaternion.setFromAxisAngle( axis, angle );

				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

				_lastAxis.copy( axis );
				_lastAngle = angle;

			} else if ( ! _this.staticMoving && _lastAngle ) {

				_lastAngle *= Math.sqrt( 1.0 - _this.dynamicDampingFactor );
				_eye.copy( _this.object.position ).sub( _this.target );
				quaternion.setFromAxisAngle( _lastAxis, _lastAngle );
				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

			}

			_movePrev.copy( _moveCurr );
			*/
			
			//quaternion.setFromRotationMatrix(ab_quat);
			//_eye.copy(this.eyeStart.clone().applyQuaternion(quaternion));
			//_this.object.up.copy(this.upStart.clone().applyQuaternion(quaternion));
			//return;

			// arcball
			angle = Math.acos( _rotateStart.dot( _rotateEnd ) / _rotateStart.length() / _rotateEnd.length() );

			if ( angle ) {
                
				axis = ( new THREE.Vector3() ).crossVectors( _rotateStart, _rotateEnd ).normalize();
				quaternion = new THREE.Quaternion();

				angle *= _this.rotateSpeed;
				quaternion.setFromAxisAngle( axis, -angle );

				//_eye.applyQuaternion( quaternion );
				//_this.object.up.applyQuaternion( quaternion );
                
                _eye.copy(this.eyeStart.clone().applyQuaternion(quaternion));
                _this.object.up.copy(this.upStart.clone().applyQuaternion(quaternion));

				/*_rotateEnd.applyQuaternion( quaternion );

				if ( _this.staticMoving ) {

					_rotateStart = _rotateEnd;

				} else {

					quaternion.setFromAxisAngle( axis, angle * ( _this.dynamicDampingFactor - 1.0 ) );
					_rotateStart.applyQuaternion( quaternion );

				}*/

			}
			
		};

	}() );


	this.zoomCamera = function () {

		var factor;

		if ( _state === STATE.TOUCH_ZOOM_PAN ) {

			factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
			_touchZoomDistanceStart = _touchZoomDistanceEnd;
			_eye.multiplyScalar( factor );

		} else {

			factor = 1.0 + ( _zoomEnd.y - _zoomStart.y ) * _this.zoomSpeed;

			if ( factor !== 1.0 && factor > 0.0 ) {

				_eye.multiplyScalar( factor );

			}

			if ( _this.staticMoving ) {

				_zoomStart.copy( _zoomEnd );

			} else {

				_zoomStart.y += ( _zoomEnd.y - _zoomStart.y ) * this.dynamicDampingFactor;

			}

		}

	};

	this.panCamera = ( function() {

		var mouseChange = new THREE.Vector2(),
			objectUp = new THREE.Vector3(),
			pan = new THREE.Vector3();

		return function panCamera() {

			mouseChange.copy( _panEnd ).sub( _panStart );

			if ( mouseChange.lengthSq() ) {

				mouseChange.multiplyScalar( _eye.length() * _this.panSpeed );

				pan.copy( _eye ).cross( _this.object.up ).setLength( mouseChange.x );
				pan.add( objectUp.copy( _this.object.up ).setLength( mouseChange.y ) );

				_this.object.position.add( pan );
				_this.target.add( pan );

				if ( _this.staticMoving ) {

					_panStart.copy( _panEnd );

				} else {

					_panStart.add( mouseChange.subVectors( _panEnd, _panStart ).multiplyScalar( _this.dynamicDampingFactor ) );

				}

			}

		};

	}() );

	this.checkDistances = function () {

		if ( ! _this.noZoom || ! _this.noPan ) {

			if ( _eye.lengthSq() > _this.maxDistance * _this.maxDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.maxDistance ) );
				_zoomStart.copy( _zoomEnd );

			}

			if ( _eye.lengthSq() < _this.minDistance * _this.minDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.minDistance ) );
				_zoomStart.copy( _zoomEnd );

			}

		}

	};

	this.update = function () {

        _eye.subVectors(_this.object.position, _this.target);

		if ( ! _this.noRotate ) {

			_this.rotateCamera();

		}

		if ( ! _this.noZoom ) {

			_this.zoomCamera();

		}

		if ( ! _this.noPan ) {

			_this.panCamera();

		}

		_this.object.position.addVectors( _this.target, _eye );

		_this.checkDistances();

		_this.object.lookAt( _this.target );

		if ( lastPosition.distanceToSquared( _this.object.position ) > EPS ) {

			_this.dispatchEvent( changeEvent );

			lastPosition.copy( _this.object.position );

		}

	};

	this.reset = function () {

		_state = STATE.NONE;
		_prevState = STATE.NONE;

		_this.target.copy( _this.target0 );
		_this.object.position.copy( _this.position0 );
		_this.object.up.copy( _this.up0 );

		_eye.subVectors( _this.object.position, _this.target );

		_this.object.lookAt( _this.target );

		_this.dispatchEvent( changeEvent );

		lastPosition.copy( _this.object.position );

    };

    // arcball functions

    //========================================================================================
    // set arcball zoom  (float, THREE.Vector3, THREE.Vector3, THREE.Martix4, THREE.Vector4)
    //========================================================================================
    function arcball_setzoom(radius, eye, up, projMatrix, viewport)
	{
		ab_eye = eye.clone().normalize; // store eye vector
		ab_zoom2 = ab_eye * ab_eye;
		ab_zoom = Math.sqrt(ab_zoom2); // store eye distance
		ab_sphere = radius; // sphere radius
		ab_sphere2 = ab_sphere * ab_sphere;
		ab_eyedir = ab_eye * (1.0 / ab_zoom); // distance to eye
		ab_edge = ab_sphere2 / ab_zoom; // plane of visible edge

		if (ab_sphere <= 0.0) // trackball mode
		{
			ab_planar = true;
			ab_up = up;
			ab_out.crossVectors(ab_eyedir, ab_up);
			ab_planedist = (0.0 - ab_sphere) * ab_zoom;
		}
		else
		{
			ab_planar = false;
		}

		ab_glp = projMatrix;
		ab_glv = viewport;
    }

    //========================================================================================
    // convert the quaternion into a rotation matrix (THREE.Martix4, float, float, float, float)
    //========================================================================================
    function quaternion(q, x, y, z, w)
    {
        var x2 = x * x;
        var y2 = y * y;
        var z2 = z * z;
        var xy = x * y;
        var xz = x * z;
        var yz = y * z;
        var wx = w * x;
        var wy = w * y;
        var wz = w * z;

        mat = q;
        mat.elements[0] = 1 - 2 * y2 - 2 * z2;
        mat.elements[1] = 2 * xy + 2 * wz;
        mat.elements[2] = 2 * xz - 2 * wy;

        mat.elements[4] = 2 * xy - 2 * wz;
        mat.elements[5] = 1 - 2 * x2 - 2 * z2;
        mat.elements[6] = 2 * yz + 2 * wx;

        mat.elements[8] = 2 * xz + 2 * wy;
        mat.elements[9] = 2 * yz - 2 * wx;
        mat.elements[10] = 1 - 2 * x2 - 2 * y2;

        return mat;
    }


    //========================================================================================
    // find the intersection with the sphere
    //========================================================================================
    function sphere_coords(mx, my) {
        var width = ab_glv.z;
        var height = ab_glv.w;
        var radius = Math.min(width / 2.0, height / 2.0) * ab_sphere;
        var center = new THREE.Vector3(width / 2.0, height / 2.0, -Math.min(width / 2.0, height / 2.0));
        var v = new THREE.Vector3((mx - center.x) / radius, (my - center.y) / radius, 0.0);
        var mag = v.x * v.x + v.y * v.y;
        if (mag > 1.0)
        {
            v.normalize();
        }
        else
        {
			v.z = Math.sqrt(1.0 - mag);
        }
        return v;
    }

    //========================================================================================
    // get intersection with plane for "trackball" style rotation
    //========================================================================================
	function planar_coords(mx, my)
	{
        var ax, ay, az;

        //gluUnProject(mx, my, 0, ab_glm, ab_glp, ab_glv, &ax, &ay, &az);
        var m = new THREE.Vector3(ax, ay, az).sub(ab_eye);
        // intersect the point with the trackball plane
        var t = (ab_planedist - ab_zoom) / (ab_eyedir.dot(m));
        var d = ab_eye.clone().add(m.multiplyScalar(t));

		return new THREE.Vector3(d * ab_up, d * ab_out, 0.0);
    }

    //========================================================================================
    // reset the arcball
    //========================================================================================
    function arcball_reset()
    {
        ab_quat.identity();
        ab_last.identity();
    }

    //========================================================================================
    // begin arcball rotation
    //========================================================================================
    function arcball_start(mx, my)
    {
        // saves a copy of the current rotation for comparison
        ab_last = ab_quat;
        if (ab_planar) ab_start = planar_coords(mx, my);
        else ab_start = sphere_coords(mx, my);
    }

    // update current arcball rotation
    function arcball_move(mx, my)
    {
        if (ab_planar)
        {
            ab_curr = planar_coords(mx, my);
            if (ab_curr.equals(ab_start)) return;

            // d is motion since the last position
            var d = ab_curr.sub(ab_start);

            var angle = d.length() * 0.5;
            var cosa = Math.cos(angle);
            var sina = Math.sin(angle);
            // p is perpendicular to d
            var p = new THREE.Vector3();
            p = ((ab_out.clone().multiplyScalar(d.x)).sub(ab_up.clone().multiplyScalar(d.y))).normalize().multiplyScalar(sina);

            ab_next.makeRotationFromQuaternion(new THREE.Quaternion(p.x, p.y, p.z, cosa));
            ab_quat.multiplyMatrices(ab_last, ab_next)
            // planar style only ever relates to the last point
            ab_last = ab_quat;
            ab_start = ab_curr;

        }
        else
        {
			ab_curr = sphere_coords(mx, my);
            if (ab_curr.equals(ab_start))
            { // avoid potential rare divide by tiny
                ab_quat = ab_last;
                return;
            }

            // use a dot product to get the angle between them
            // use a cross product to get the vector to rotate around
            var cos2a = ab_start.dot(ab_curr);
            var sina = Math.sqrt((1.0 - cos2a) * 0.5);
            var cosa = Math.sqrt((1.0 + cos2a) * 0.5);
            var cross = ab_start.clone().cross(ab_curr).normalize().multiplyScalar(sina);
            ab_next.makeRotationFromQuaternion(new THREE.Quaternion(cross.x, cross.y, cross.z, cosa));

            // update the rotation matrix
			ab_quat.multiplyMatrices(ab_last, ab_next);
        }
    }

    //========================================================================================
    // export and import arcball state matrices
    //========================================================================================
    function arcball_export_quat_matrix() {
        return ab_quat;
    }

    function arcball_export_last_matrix() {
        return ab_last;
    }

    function arcball_import_quat_matrix(new_ab_quat) {
        // sanity
        //for (int i = 0; i < 16; i++) if (mathtools::is_ind(new_ab_quat[i])) return;

        //for (int i = 0; i < 16; i++) ab_quat[i] = new_ab_quat[i];
    }

    function arcball_import_last_matrix(new_ab_last) {
        // sanity
        //for (int i = 0; i < 16; i++) if (mathtools::is_ind(new_ab_last[i])) return;

        //for (int i = 0; i < 16; i++) ab_last[i] = new_ab_last[i];
    }

	// listeners

	function keydown( event ) {

		if ( _this.enabled === false ) return;

		window.removeEventListener( 'keydown', keydown );

		_prevState = _state;

		if ( _state !== STATE.NONE ) {

			return;

		} else if ( event.keyCode === _this.keys[ STATE.ROTATE ] && ! _this.noRotate ) {

			_state = STATE.ROTATE;

		} else if ( event.keyCode === _this.keys[ STATE.ZOOM ] && ! _this.noZoom ) {

			_state = STATE.ZOOM;

		} else if ( event.keyCode === _this.keys[ STATE.PAN ] && ! _this.noPan ) {

			_state = STATE.PAN;

		}

	}

	function keyup( event ) {

		if ( _this.enabled === false ) return;

		_state = _prevState;

		window.addEventListener( 'keydown', keydown, false );

	}

	function mousedown( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		if ( _state === STATE.NONE ) {

			_state = event.button;

		}

		if ( _state === STATE.ROTATE && ! _this.noRotate ) {

			//_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );
			//_movePrev.copy( _moveCurr );
            _this.eyeStart.subVectors( _this.object.position, _this.target );
            _this.upStart.copy(_this.object.up);
            _eye.copy( _this.eyeStart );
			_rotateStart.copy( getMouseProjectionOnBall( event.pageX, event.pageY ) );
			_rotateEnd.copy(_rotateStart);

			arcball_start( event.pageX, event.pageY );

		} else if ( _state === STATE.ZOOM && ! _this.noZoom ) {

			_zoomStart.copy( getMouseOnScreen( event.pageX, event.pageY ) );
			_zoomEnd.copy( _zoomStart );

		} else if ( _state === STATE.PAN && ! _this.noPan ) {

			_panStart.copy( getMouseOnScreen( event.pageX, event.pageY ) );
			_panEnd.copy( _panStart );

		}

		document.addEventListener( 'mousemove', mousemove, false );
		document.addEventListener( 'mouseup', mouseup, false );

		_this.dispatchEvent( startEvent );

	}

	function mousemove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		if ( _state === STATE.ROTATE && ! _this.noRotate ) {

			//_movePrev.copy( _moveCurr );
			//_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );
			_rotateEnd.copy(getMouseProjectionOnBall(event.pageX, event.pageY));

			arcball_move(event.pageX, event.pageY);

		} else if ( _state === STATE.ZOOM && ! _this.noZoom ) {

			_zoomEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

		} else if ( _state === STATE.PAN && ! _this.noPan ) {

			_panEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

		}

	}

	function mouseup( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
        event.stopPropagation();

		_state = STATE.NONE;
		
		document.removeEventListener( 'mousemove', mousemove );
		document.removeEventListener( 'mouseup', mouseup );
		_this.dispatchEvent( endEvent );

	}

	function mousewheel( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.deltaMode ) {

			case 2:
				// Zoom in pages
				_zoomStart.y -= event.deltaY * 0.025;
				break;

			case 1:
                // Zoom in lines
				_zoomStart.y -= event.deltaY * 0.01;
				break;

			default:
				// undefined, 0, assume pixels
				_zoomStart.y -= event.deltaY * 0.00025;
				break;

		}

		_this.dispatchEvent( startEvent );
		_this.dispatchEvent( endEvent );

	}

	function touchstart( event ) {

		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:
				_state = STATE.TOUCH_ROTATE;
				//_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
                //_movePrev.copy( _moveCurr );
                _this.eyeStart.subVectors( _this.object.position, _this.target );
                _this.upStart.copy( _this.object.up );
                _eye.copy( _this.eyeStart );
				_rotateStart.copy( getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				_rotateEnd.copy( _rotateStart );
				break;

			default: // 2 or more
				_state = STATE.TOUCH_ZOOM_PAN;
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt( dx * dx + dy * dy );

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panStart.copy( getMouseOnScreen( x, y ) );
				_panEnd.copy( _panStart );
				break;

		}

		_this.dispatchEvent( startEvent );

	}

	function touchmove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1:
				//_movePrev.copy( _moveCurr );
				//_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				_rotateEnd.copy( getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				break;

			default: // 2 or more
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = Math.sqrt( dx * dx + dy * dy );

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panEnd.copy( getMouseOnScreen( x, y ) );
				break;

		}

	}

	function touchend( event ) {

		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 0:
				_state = STATE.NONE;
				break;

			case 1:
				_state = STATE.TOUCH_ROTATE;
				//_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				//_movePrev.copy( _moveCurr );
				_rotateEnd.copy( getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				break;

		}

		_this.dispatchEvent( endEvent );

	}

	function contextmenu( event ) {

		event.preventDefault();

	}

	this.dispose = function() {

		this.domElement.removeEventListener( 'contextmenu', contextmenu, false );
		this.domElement.removeEventListener( 'mousedown', mousedown, false );
		this.domElement.removeEventListener( 'wheel', mousewheel, false );

		this.domElement.removeEventListener( 'touchstart', touchstart, false );
		this.domElement.removeEventListener( 'touchend', touchend, false );
		this.domElement.removeEventListener( 'touchmove', touchmove, false );

		document.removeEventListener( 'mousemove', mousemove, false );
		document.removeEventListener( 'mouseup', mouseup, false );

		window.removeEventListener( 'keydown', keydown, false );
		window.removeEventListener( 'keyup', keyup, false );

	};

	this.domElement.addEventListener( 'contextmenu', contextmenu, false );
	this.domElement.addEventListener( 'mousedown', mousedown, false );
	this.domElement.addEventListener( 'wheel', mousewheel, false );

	this.domElement.addEventListener( 'touchstart', touchstart, false );
	this.domElement.addEventListener( 'touchend', touchend, false );
	this.domElement.addEventListener( 'touchmove', touchmove, false );

	window.addEventListener( 'keydown', keydown, false );
	window.addEventListener( 'keyup', keyup, false );

	this.handleResize();

	// force an update at start
	this.update();

};

THREE.TrackballControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.TrackballControls.prototype.constructor = THREE.TrackballControls;
