function getBookPath()
{
	var query = window.location.href.split('?')[1];
	//query won't be set if ? isn't in the URL
	if(!query) {
		return { };
	}

	var params = query.split('&');

	var pairs = {};
	for(var i = 0, len = params.length; i < len; i++) {
		var pair = params[i].split('=');
		pairs[pair[0]] = pair[1];
		console.log(pair[1])
	}

	var res = pairs['bookPath'].split('#');

	return res[0];
}

EPUBJS.reader.ReaderController = function(book) {
	var $main = $("#main"),
			$divider = $("#divider"),
			$loader = $("#loader"),
			$next = $("#next"),
			$prev = $("#prev"),
			$voting = $("#votingModal"),
			$votingSubmit = $("#votingSubmit"),
			$rate = $("#rate");
	var reader = this;
	var book = this.book;
	var rendition = this.rendition;
	var slideIn = function() {
		var currentPosition = rendition.currentLocation().start.cfi;
		if (reader.settings.sidebarReflow){
			$main.removeClass('single');
			$main.one("transitionend", function(){
				rendition.resize();
			});
		} else {
			$main.removeClass("closed");
		}
	};

	var slideOut = function() {
		var location = rendition.currentLocation();
		if (!location) {
			return;
		}
		var currentPosition = location.start.cfi;
		if (reader.settings.sidebarReflow){
			$main.addClass('single');
			$main.one("transitionend", function(){
				rendition.resize();
			});
		} else {
			$main.addClass("closed");
		}
	};

	var showLoader = function() {
		$loader.show();
		hideDivider();
	};

	var hideLoader = function() {
		$loader.hide();

		//-- If the book is using spreads, show the divider
		// if(book.settings.spreads) {
		// 	showDivider();
		// }
	};

	var showDivider = function() {
		$divider.addClass("show");
	};

	var hideDivider = function() {
		$divider.removeClass("show");
	};

	var keylock = false;

	var arrowKeys = function(e) {
		if(e.keyCode == 37) {

			if(book.package.metadata.direction === "rtl") {
				rendition.next();
			} else {
				rendition.prev();
			}

			$prev.addClass("active");

			keylock = true;
			setTimeout(function(){
				keylock = false;
				$prev.removeClass("active");
			}, 100);

			 e.preventDefault();
		}
		if(e.keyCode == 39) {

			if(book.package.metadata.direction === "rtl") {
				rendition.prev();
			} else {
				rendition.next();
			}

			$next.addClass("active");

			keylock = true;
			setTimeout(function(){
				keylock = false;
				$next.removeClass("active");
			}, 100);

			 e.preventDefault();
		}
	}

	document.addEventListener('keydown', arrowKeys, false);

	$votingSubmit.on("click", function(e) {
		var addr = hashCreate(getBookPath());
		console.log(addr);
		var value = $rate.val();

		if (!value)
		{
			value = 0;
		}

		var rating = {
			"rating" : value
		};
		var rating_json = JSON.stringify(rating);
		
		push_rating(addr, rating_json);

		$voting.removeClass("md-show");
	});

	$next.on("click", function(e) {

		if(book.package.metadata.direction === "rtl") {
			rendition.prev();
		} else {
			rendition.next();
		}

		// var curLocation = rendition.currentLocation();
		// var percent = book.locations.percentageFromCfi(curLocation.start.cfi);
		// console.log("%d", location.length);
		//$voting.addClass("md-show");

		e.preventDefault();
	});

	$prev.on("click", function(e){

		if(book.package.metadata.direction === "rtl") {
			rendition.next();
		} else {
			rendition.prev();
		}

		e.preventDefault();
	});

	rendition.on("layout", function(props){
		if(props.spread === true) {
			showDivider();
		} else {
			hideDivider();
		}
	});

	rendition.on('relocated', function(location) {
		var total = location.end.displayed.total;
		var page = location.end.displayed.page;

		if (page == total - 1)
		{
			console.log("relocated %d", page);
			$voting.addClass("md-show");
		}

		if (location.atStart) {
			$prev.addClass("disabled");
		}

		if (location.atEnd) {
			$next.addClass("disabled");
		}
	});

	return {
		"slideOut" : slideOut,
		"slideIn"  : slideIn,
		"showLoader" : showLoader,
		"hideLoader" : hideLoader,
		"showDivider" : showDivider,
		"hideDivider" : hideDivider,
		"arrowKeys" : arrowKeys
	};
};
